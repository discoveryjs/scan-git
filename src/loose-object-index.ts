import { join as pathJoin } from 'path';
import { promises as fsPromises } from 'fs';
import { inflateSync } from './fast-inflate.js';
import {
    GitObject,
    InternalGitObjectContent,
    InternalGitObjectHeader,
    ObjectsTypeStat,
    PackedObjectType
} from './types.js';
import { binarySearchHash } from './utils/binary-search.js';
import { createObjectsTypeStat, objectsStatFromTypes } from './utils/stat.js';
import { promiseAllThreaded } from './utils/threads.js';

type LooseObjectMap = Map<string, string>;
type LooseObjectMapEntry = [oid: string, relpath: string];

async function createLooseObjectMap(gitdir: string): Promise<LooseObjectMap> {
    const objectsPath = pathJoin(gitdir, 'objects');
    const looseDirs = (await fsPromises.readdir(objectsPath)).filter((p) =>
        /^[0-9a-f]{2}$/.test(p)
    );

    const objectDirs = await promiseAllThreaded(20, looseDirs, (dir) =>
        fsPromises
            .readdir(pathJoin(objectsPath, dir))
            .then((files) =>
                files.map((file): LooseObjectMapEntry => [dir + file, `objects/${dir}/${file}`])
            )
    );

    return new Map(objectDirs.flat().sort(([a], [b]) => (a < b ? -1 : 1)));
}

function indexObjectNames(sortedNames: string[]) {
    const fanoutTable = new Array<[start: number, end: number]>(256);
    const binaryNames = Buffer.from(sortedNames.join(''), 'hex');

    for (let i = 0, offset = 0; i < 256; i++) {
        const prevOffset = offset;

        while (offset < binaryNames.length && binaryNames[offset * 20] === i) {
            offset++;
        }

        fanoutTable[i] = [prevOffset, offset];
    }

    return {
        fanoutTable,
        binaryNames,
        names: sortedNames
    };
}

function parseLooseObjectHeader(buffer: Buffer): InternalGitObjectHeader {
    const spaceIndex = buffer.indexOf(32); // first space
    const nullIndex = buffer.indexOf(0, spaceIndex + 1); // first null is the end of header
    const type = buffer.toString('utf8', 0, spaceIndex) as GitObject['type'];
    const length = parseInt(buffer.toString('utf8', spaceIndex + 1, nullIndex), 10);

    return {
        type,
        length
    };
}

function parseLooseObject(buffer: Buffer): InternalGitObjectContent {
    const spaceIndex = buffer.indexOf(32); // first space
    const nullIndex = buffer.indexOf(0, spaceIndex + 1); // first null value
    const type = buffer.toString('utf8', 0, spaceIndex) as GitObject['type']; // get type of object

    return {
        type,
        object: buffer.slice(nullIndex + 1)
    };
}

export async function createLooseObjectIndex(gitdir: string) {
    const looseObjectMap = await createLooseObjectMap(gitdir);
    const { fanoutTable, binaryNames, names } = indexObjectNames([...looseObjectMap.keys()]);

    const getOidFromHash = (hash: Buffer) => {
        const [start, end] = fanoutTable[hash[0]];
        const idx = start !== end ? binarySearchHash(binaryNames, hash, start, end - 1) : -1;

        if (idx !== -1) {
            return names[idx];
        }

        return null;
    };

    const readObjectHeaderByOid = async (oid: string) => {
        const relpath = looseObjectMap.get(oid);

        if (relpath !== undefined) {
            let fh: fsPromises.FileHandle | null = null;
            try {
                fh = await fsPromises.open(pathJoin(gitdir, relpath));

                const headerBuffer = Buffer.alloc(512);
                await fh.read(headerBuffer, 0, 512, 0);

                return parseLooseObjectHeader(inflateSync(headerBuffer));
            } finally {
                fh?.close();
            }
        }

        return null;
    };
    const readObjectByOid = async (oid: string) => {
        const relpath = looseObjectMap.get(oid);

        if (relpath !== undefined) {
            const deflated = await fsPromises.readFile(pathJoin(gitdir, relpath));

            return parseLooseObject(inflateSync(deflated));
        }

        return null;
    };

    return {
        readObjectHeaderByOid,
        readObjectHeaderByHash(hash: Buffer) {
            const oid = getOidFromHash(hash);

            return oid !== null ? readObjectHeaderByOid(oid) : null;
        },
        readObjectByOid,
        readObjectByHash(hash: Buffer) {
            const oid = getOidFromHash(hash);

            return oid !== null ? readObjectByOid(oid) : null;
        },

        dispose() {
            looseObjectMap.clear();
        },

        async stat() {
            const files = [];
            const objectsByType: Record<PackedObjectType, ObjectsTypeStat> = Object.create(null);

            for (const [oid, relpath] of looseObjectMap) {
                const [stat, objectHeader] = await Promise.all([
                    fsPromises.stat(pathJoin(gitdir, relpath)),
                    readObjectHeaderByOid(oid)
                ]);

                if (objectHeader !== null) {
                    if (objectHeader.type in objectsByType === false) {
                        objectsByType[objectHeader.type] = createObjectsTypeStat(objectHeader.type);
                    }

                    objectsByType[objectHeader.type].count++;
                    objectsByType[objectHeader.type].size += stat.size;
                    objectsByType[objectHeader.type].unpackedSize += objectHeader.length;
                }

                files.push({
                    path: relpath,
                    size: stat.size,
                    object: {
                        oid,
                        ...objectHeader
                    }
                });
            }

            return {
                objects: objectsStatFromTypes(Object.values(objectsByType)),
                files
            };
        }
    };
}
