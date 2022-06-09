import { createReadObject } from './read-object.js';
import { createRefIndex } from './resolve-ref.js';
import { createLooseObjectIndex } from './loose-object-index.js';
import { createPackedObjectIndex } from './packed-object-index.js';
import { createFilesMethods } from './files-list.js';

export * from './types.js';
export async function createGitReader(gitdir: string) {
    const getExternalRefDelta = (oid: string) => readObjectByOid(oid);
    const [refIndex, looseObjectIndex, packedObjectIndex] = await Promise.all([
        createRefIndex(gitdir),
        createLooseObjectIndex(gitdir),
        createPackedObjectIndex(gitdir, getExternalRefDelta)
    ]);
    const { readObjectByHash, readObjectByOid } = createReadObject(
        looseObjectIndex,
        packedObjectIndex
    );

    return {
        readObjectByHash,
        readObjectByOid,
        ...refIndex,
        ...createFilesMethods(readObjectByOid, readObjectByHash, refIndex.resolveRef)
    };
}
