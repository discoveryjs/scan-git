import { join as pathJoin, relative as pathRelative, basename } from 'path';
import { promises as fsPromises } from 'fs';
import { PackContent, readPackFile } from './packed-pack.js';
import {
    InternalGitObjectContent,
    InternalGitObjectHeader,
    PackedObjectType,
    ObjectsTypeStat,
    NormalizedGitReaderOptions
} from './types.js';
import { objectsStatFromTypes, sumObjectsStat } from './utils/stat.js';

/**
 * Creates an index object that provides information about git objects stored within pack files
 * @param gitdir
 * @param options
 */
export async function createPackedObjectIndex(
    gitdir: string,
    { cruftPacks }: NormalizedGitReaderOptions
) {
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
            const index = packFile.getObjectIndex(hash);

            if (index !== -1) {
                return packFile.readObjectByIndex(index, cache);
            }
        }

        return null;
    }

    const packdir = pathJoin(gitdir, 'objects/pack');
    const packdirFiles = await fsPromises.readdir(packdir);
    const cruftPackFileNames =
        cruftPacks !== 'include'
            ? packdirFiles.filter((f) => f.endsWith('.mtimes')).map((f) => basename(f, '.mtimes'))
            : [];

    const packFilenames = packdirFiles
        .filter((filename) => {
            if (!filename.endsWith('.pack')) {
                return false;
            }

            if (cruftPacks === 'include') {
                return true;
            }

            const fnWithoutExt = basename(filename, '.pack');
            return cruftPacks === 'only'
                ? cruftPackFileNames.includes(fnWithoutExt)
                : !cruftPackFileNames.includes(fnWithoutExt);
        })
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
                    path: pathRelative(gitdir, pack.filename),
                    size: pack.filesize,
                    objects: objectsStatFromTypes(packObjectsByType),
                    index: {
                        path: pathRelative(gitdir, pack.index.filename),
                        size: pack.index.filesize,
                        namesBytes: pack.index.namesBytes,
                        offsetsBytes: pack.index.offsetsBytes,
                        largeOffsetsBytes: pack.index.largeOffsetsBytes
                    },
                    reverseIndex: pack.reverseIndex?.filename
                        ? {
                              path: pathRelative(gitdir, pack.reverseIndex.filename),
                              size: pack.reverseIndex.filesize
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
