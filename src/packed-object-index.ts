import { join as pathJoin } from 'path';
import { promises as fsPromises } from 'fs';
import { PackContent, readPackFile } from './packed-pack.js';
import { objectsStatFromTypes, sumObjectsStat } from './utils/stat.js';
import { promiseAllThreaded } from './utils/threads.js';
import {
    InternalGitObjectContent,
    InternalGitObjectHeader,
    PackedObjectType,
    ObjectsTypeStat,
    NormalizedGitReaderOptions
} from './types.js';

const PACKDIR = 'objects/pack';

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

    const packdirFilenames = await fsPromises.readdir(pathJoin(gitdir, PACKDIR));
    const cruftPackFilenames =
        cruftPacks !== 'include'
            ? packdirFilenames
                  .filter((filename) => filename.endsWith('.mtimes'))
                  .map((filename) => filename.replace(/\.mtimes/, '.pack'))
            : [];

    const packFilenames = packdirFilenames.filter((filename) => {
        if (!filename.endsWith('.pack')) {
            return false;
        }

        if (cruftPacks === 'include') {
            return true;
        }

        return cruftPacks === 'only'
            ? cruftPackFilenames.includes(filename)
            : !cruftPackFilenames.includes(filename);
    });

    const packFiles = await promiseAllThreaded(20, packFilenames, async (filename) =>
        readPackFile(gitdir, `${PACKDIR}/${filename}`, readObjectHeaderByHash, readObjectByHash)
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

        dispose() {
            packFiles.forEach((packFile) => packFile.close());
            packFiles.length = 0;
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
                    path: pack.filename,
                    size: pack.filesize,
                    objects: objectsStatFromTypes(packObjectsByType),
                    index: {
                        path: pack.index.filename,
                        size: pack.index.filesize,
                        namesBytes: pack.index.namesBytes,
                        offsetsBytes: pack.index.offsetsBytes,
                        largeOffsetsBytes: pack.index.largeOffsetsBytes
                    },
                    reverseIndex: pack.reverseIndex?.filename
                        ? {
                              path: pack.reverseIndex.filename,
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
                            }) as ObjectsTypeStat
                    )
                ),
                files
            };
        }
    };
}
