import { join as pathJoin, relative as pathRelative } from 'path';
import { promises as fsPromises } from 'fs';
import { PackContent, readPackFile } from './packed-pack.js';
import {
    InternalGitObjectContent,
    InternalGitObjectHeader,
    PackedObjectType,
    ObjectsTypeStat
} from './types.js';
import { objectsStatFromTypes, sumObjectsStat } from './utils/stat.js';

export async function createPackedObjectIndex(gitdir: string) {
    function readObjectHeaderByHash(
        hash: Buffer,
        exclude: PackContent | null = null
    ): Promise<InternalGitObjectHeader | null> | null {
        for (const packFile of packFiles) {
            if (packFile !== exclude) {
                const index = packFile.getObjectIndex(hash);

                if (index !== -1) {
                    return packFile.readObjectHeaderByIndex(index);
                }
            }
        }

        return null;
    }

    function readObjectByHash(
        hash: Buffer,
        cache?: boolean
    ): Promise<InternalGitObjectContent | null> | null {
        for (const packFile of packFiles) {
            const idnex = packFile.getObjectIndex(hash);

            if (idnex !== -1) {
                return packFile.readObjectByIndex(idnex, cache);
            }
        }

        return null;
    }

    const packdir = pathJoin(gitdir, 'objects/pack');
    const packFilenames = (await fsPromises.readdir(packdir))
        .filter((filename) => filename.endsWith('.pack'))
        .map((filename) => `${packdir}/${filename}`);

    const packFiles = await Promise.all(
        packFilenames.map((filename) =>
            readPackFile(filename, readObjectHeaderByHash, readObjectByHash)
        )
    );

    return {
        readObjectHeaderByHash,
        readObjectHeaderByOid(oid: string) {
            return readObjectHeaderByHash(Buffer.from(oid, 'hex'));
        },
        readObjectByHash,
        readObjectByOid(oid: string, cache?: boolean) {
            return readObjectByHash(Buffer.from(oid, 'hex'), cache);
        },

        async stat() {
            const objectsByType: Record<PackedObjectType, ObjectsTypeStat[]> = Object.create(null);
            const files = [];

            for (const pack of packFiles) {
                const packObjectsByType = await pack.objectsStat();

                for (const stat of packObjectsByType) {
                    objectsByType[stat.type] = objectsByType[stat.type] || [];
                    objectsByType[stat.type].push(stat);
                }

                files.push({
                    filename: pathRelative(gitdir, pack.filename),
                    filesize: pack.filesize,
                    objects: objectsStatFromTypes(packObjectsByType),
                    index: {
                        filename: pathRelative(gitdir, pack.index.filename),
                        filesize: pack.index.filesize,
                        namesBytes: pack.index.namesBytes,
                        offsetsBytes: pack.index.offsetsBytes,
                        largeOffsetsBytes: pack.index.largeOffsetsBytes
                    },
                    reverseIndex: pack.reverseIndex?.filename
                        ? {
                              filename: pathRelative(gitdir, pack.reverseIndex.filename),
                              filesize: pack.reverseIndex.filesize
                          }
                        : null
                });
            }

            return {
                objects: objectsStatFromTypes(
                    Object.entries(objectsByType).map(
                        ([type, stat]) =>
                            ({
                                type,
                                ...sumObjectsStat(stat)
                            } as ObjectsTypeStat)
                    )
                ),
                files
            };
        }
    };
}
