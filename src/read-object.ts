import { EMPTY_TREE_HASH, EMPTY_TREE_OID } from './const.js';
import {
    InternalGitObjectContent,
    InternalGitObjectHeader,
    LooseObjectIndex,
    PackedObjectIndex
} from './types';

export function createReadObject(
    looseObjectIndex: LooseObjectIndex,
    packedObjectIndex: PackedObjectIndex
) {
    async function readObjectHeaderByHash(hash: Buffer) {
        let result: InternalGitObjectHeader | null =
            (await looseObjectIndex.readObjectHeaderByHash(hash)) ||
            (await packedObjectIndex.readObjectHeaderByHash(hash)) ||
            null;

        if (result === null) {
            if (hash.equals(EMPTY_TREE_HASH)) {
                result = { type: 'tree', length: 0 };
            } else {
                throw new Error(`Object with id "${hash.toString('hex')}" is not found`);
            }
        }

        return result;
    }

    async function readObjectByHash(hash: Buffer) {
        let result: InternalGitObjectContent | null =
            (await looseObjectIndex.readObjectByHash(hash)) ||
            (await packedObjectIndex.readObjectByHash(hash)) ||
            null;

        if (result === null) {
            if (hash.equals(EMPTY_TREE_HASH)) {
                result = { type: 'tree', object: Buffer.from('') };
            } else {
                throw new Error(`Object with id "${hash.toString('hex')}" is not found`);
            }
        }

        return result;
    }

    async function readObjectHeaderByOid(oid: string) {
        let result: InternalGitObjectHeader | null =
            (await looseObjectIndex.readObjectHeaderByOid(oid)) ||
            (await packedObjectIndex.readObjectHeaderByOid(oid)) ||
            null;

        if (result === null) {
            if (oid === EMPTY_TREE_OID) {
                result = { type: 'tree', length: 0 };
            } else {
                throw new Error(`Object with id "${oid}" is not found`);
            }
        }

        return result;
    }

    async function readObjectByOid(oid: string) {
        let result: InternalGitObjectContent | null =
            (await looseObjectIndex.readObjectByOid(oid)) ||
            (await packedObjectIndex.readObjectByOid(oid)) ||
            null;

        if (result === null) {
            if (oid === EMPTY_TREE_OID) {
                result = { type: 'tree', object: Buffer.from('') };
            } else {
                throw new Error(`Object with id "${oid}" is not found`);
            }
        }

        return result;
    }

    return {
        readObjectHeaderByHash,
        readObjectByHash,
        readObjectHeaderByOid,
        readObjectByOid
    };
}
