import { inflateSync as zlibInflate } from 'zlib';
import { EMPTY_TREE_HASH, EMPTY_TREE_OID } from './const.js';
import {
    GitObject,
    InternalGitObject,
    InternalGitObjectContent,
    LooseObjectIndex,
    PackedObjectIndex,
    ReadResult
} from './types';

function unwrapGitObject(buffer: Buffer): InternalGitObjectContent {
    const spaceIndex = buffer.indexOf(32); // first space
    const nullIndex = buffer.indexOf(0, spaceIndex + 1); // first null value
    const type = buffer.toString('utf8', 0, spaceIndex) as GitObject['type']; // get type of object
    const length = buffer.toString('utf8', spaceIndex + 1, nullIndex); // get type of object
    const actualLength = buffer.length - (nullIndex + 1);

    // verify length
    if (parseInt(length) !== actualLength) {
        throw new Error(
            `Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
        );
    }

    return {
        type,
        format: 'content',
        object: Buffer.from(buffer.slice(nullIndex + 1)) // FIXME: remove Buffer.from?
    };
}

export function createReadObject(
    looseObjectIndex: LooseObjectIndex,
    packedObjectIndex: PackedObjectIndex
) {
    async function readObjectByHash<T extends ReadResult['format'] = 'content'>(
        hash: Buffer,
        format?: T
    ): Promise<Extract<ReadResult, { format: T }>>;
    async function readObjectByHash(hash: Buffer, format: ReadResult['format'] = 'content') {
        let result: InternalGitObject | null = null;

        if (hash.equals(EMPTY_TREE_HASH)) {
            result = { format: 'wrapped', object: Buffer.from('tree 0\x00') };
        }

        // Seek for the object in the loose object directory
        if (!result) {
            result = await looseObjectIndex.readByHash(hash);
        }

        // Seek for the object in the pack files
        if (!result) {
            result = await packedObjectIndex.readByHash(hash);
        }

        if (!result) {
            throw new Error(`Object with id "${hash.toString('hex')}" is not found`);
        }

        return decodeObject(result, format);
    }

    async function readObjectByOid<T extends ReadResult['format'] = 'content'>(
        oid: string,
        format?: T
    ): Promise<Extract<ReadResult, { format: T }>>;
    async function readObjectByOid(oid: string, format: ReadResult['format'] = 'content') {
        let result: ReadResult | null = null;

        if (oid === EMPTY_TREE_OID) {
            result = { format: 'wrapped', object: Buffer.from('tree 0\x00') };
        }

        // Seek for the object in the loose object directory
        if (!result) {
            result = await looseObjectIndex.readByOid(oid);
        }

        // Seek for the object in the pack files
        if (!result) {
            result = await packedObjectIndex.readByOid(oid);
        }

        if (!result) {
            throw new Error(`Object with id "${oid}" is not found`);
        }

        return decodeObject(result, format);
    }

    return {
        readObjectByHash,
        readObjectByOid
    };
}

function decodeObject(result: ReadResult, format: ReadResult['format']) {
    if (result.format === 'deflated') {
        if (format === 'deflated') {
            return result;
        }

        result = {
            format: 'wrapped',
            object: zlibInflate(result.object)
        };
    }

    if (result.format === 'wrapped') {
        if (format === 'wrapped') {
            return result;
        }

        // const sha = await shasum(result.object);
        // if (sha !== oid) {
        //   throw new Error(`SHA check failed! Expected ${oid}, computed ${sha}`);
        // }
        result = unwrapGitObject(result.object);
    }

    if (result.format === 'content') {
        if (format === 'content') {
            return result;
        }
    }

    throw new Error(
        `Requested format "${format}" doesn't matched to result format "${result.format}"`
    );
}
