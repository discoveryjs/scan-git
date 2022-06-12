import { EMPTY_TREE_HASH, EMPTY_TREE_OID } from './const.js';
import { InternalGitObjectContent, LooseObjectIndex, PackedObjectIndex } from './types';

export function createReadObject(
    looseObjectIndex: LooseObjectIndex,
    packedObjectIndex: PackedObjectIndex
) {
    async function readObjectByHash(hash: Buffer) {
        let result: InternalGitObjectContent | null = null;

        // Seek for the object in the loose object directory
        if (!result) {
            result = await looseObjectIndex.readByHash(hash);
        }

        // Seek for the object in the pack files
        if (!result) {
            result = await packedObjectIndex.readByHash(hash);
        }

        if (!result && hash.equals(EMPTY_TREE_HASH)) {
            result = { type: 'tree', object: Buffer.from('') };
        }

        if (!result) {
            throw new Error(`Object with id "${hash.toString('hex')}" is not found`);
        }

        return result;
    }

    async function readObjectByOid(oid: string) {
        let result: InternalGitObjectContent | null = null;

        // Seek for the object in the loose object directory
        if (!result) {
            result = await looseObjectIndex.readByOid(oid);
        }

        // Seek for the object in the pack files
        if (!result) {
            result = await packedObjectIndex.readByOid(oid);
        }

        if (!result && oid === EMPTY_TREE_OID) {
            result = { type: 'tree', object: Buffer.from('') };
        }

        if (!result) {
            throw new Error(`Object with id "${oid}" is not found`);
        }

        return result;
    }

    return {
        readObjectByHash,
        readObjectByOid
    };
}
