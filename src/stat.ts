import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { scanFs } from '@discoveryjs/scan-fs';
import { sumObjectsStat } from './utils/stat.js';
import { promiseAllThreaded } from './utils/threads.js';
import { createRefIndex } from './resolve-ref.js';
import { createLooseObjectIndex } from './loose-object-index.js';
import { createPackedObjectIndex } from './packed-object-index.js';
import { NormalizedGitReaderOptions } from './types.js';

export function createStatMethod(
    {
        gitdir,
        refIndex,
        looseObjectIndex,
        packedObjectIndex
    }: {
        gitdir: string;
        refIndex: Awaited<ReturnType<typeof createRefIndex>>;
        looseObjectIndex: Awaited<ReturnType<typeof createLooseObjectIndex>>;
        packedObjectIndex: Awaited<ReturnType<typeof createPackedObjectIndex>>;
    },
    { concurrentFsLimit }: NormalizedGitReaderOptions
) {
    return async function () {
        const [refs, looseObjects, packedObjects, { files }] = await Promise.all([
            refIndex.stat(),
            looseObjectIndex.stat(),
            packedObjectIndex.stat(),
            scanFs(gitdir)
        ]);

        const fileStats = await promiseAllThreaded(concurrentFsLimit, files, (file) =>
            fsPromises.stat(path.join(gitdir, file.path))
        );

        const objectsTypes = looseObjects.objects.types.map((entry) => ({ ...entry }));
        for (const entry of packedObjects.objects.types) {
            const typeEntry = objectsTypes.find((typeEntry) => typeEntry.type === entry.type);

            if (typeEntry) {
                typeEntry.count += entry.count;
                typeEntry.size += entry.size;
                typeEntry.unpackedSize += entry.unpackedSize;
            } else {
                objectsTypes.push({ ...entry });
            }
        }

        return {
            size: fileStats.reduce((sum, file) => sum + file.size, 0),
            refs,
            objects: {
                ...sumObjectsStat([looseObjects.objects, packedObjects.objects]),
                types: objectsTypes,
                loose: looseObjects,
                packed: packedObjects
            },
            files: files
                .map((file, idx) => ({ path: file.posixPath, size: fileStats[idx].size }))
                .sort((a, b) => (a.path < b.path ? -1 : 1)) // all paths are unique, no need for 0
        };
    };
}
