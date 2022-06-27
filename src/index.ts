import { createReadObject } from './read-object.js';
import { createRefIndex } from './resolve-ref.js';
import { createLooseObjectIndex } from './loose-object-index.js';
import { createPackedObjectIndex } from './packed-object-index.js';
import { createFilesMethods } from './files-list.js';
import { createCommitMethods } from './commits.js';

export * from './types.js';
export * from './parse-object.js';
export async function createGitReader(gitdir: string) {
    const [refIndex, looseObjectIndex, packedObjectIndex] = await Promise.all([
        createRefIndex(gitdir),
        createLooseObjectIndex(gitdir),
        createPackedObjectIndex(gitdir)
    ]);
    const { readObjectHeaderByHash, readObjectByHash, readObjectHeaderByOid, readObjectByOid } =
        createReadObject(looseObjectIndex, packedObjectIndex);

    return {
        readObjectHeaderByHash,
        readObjectByHash,
        readObjectHeaderByOid,
        readObjectByOid,
        ...refIndex,
        ...createFilesMethods(readObjectByOid, readObjectByHash, refIndex.resolveRef),
        ...createCommitMethods(readObjectByOid, refIndex.resolveRef),

        async stat() {
            const [refs, looseObjects, packedObjects] = await Promise.all([
                refIndex.stat(),
                looseObjectIndex.stat(),
                packedObjectIndex.stat()
            ]);

            return {
                refs,
                objects: {
                    loose: looseObjects,
                    packed: packedObjects
                }
            };
        }
    };
}
