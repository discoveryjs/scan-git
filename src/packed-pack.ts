import { promises as fsPromises } from 'fs';
import { join as pathJoin } from 'path';
import { inflateSync } from './fast-inflate.js';
import { BufferCursor, readEncodedOffset, readVarIntLE } from './utils/buffer.js';
import { PackIndex, readPackIdxFile } from './packed-idx.js';
import { PackReverseIndex, readPackRevFile } from './packed-rev.js';
import { recostructDeltifiedObject } from './packed-deltified-object.js';
import { InternalGitObjectContent, InternalGitObjectHeader, ObjectsTypeStat } from './types.js';
import { checkFileHeader } from './utils/file.js';
import { createObjectsTypeStat } from './utils/stat.js';

export type ReadObjectHeaderFromAllPacks = (
    hash: Buffer
) => Promise<InternalGitObjectHeader | null> | null;
export type ReadObjectFromAllPacks = (
    hash: Buffer,
    cache?: boolean
) => Promise<InternalGitObjectContent | null> | null;

type Type = 'commit' | 'tree' | 'blob' | 'tag';
type PackedType =
    | typeof OBJ_INVALID
    | typeof OBJ_COMMIT
    | typeof OBJ_TREE
    | typeof OBJ_BLOB
    | typeof OBJ_TAG
    | typeof OBJ_RESERVED
    | typeof OBJ_OFS_DELTA
    | typeof OBJ_REF_DELTA;

// https://git-scm.com/docs/pack-format#_object_types
const OBJ_INVALID = 0;
const OBJ_COMMIT = 1;
const OBJ_TREE = 2;
const OBJ_BLOB = 3;
const OBJ_TAG = 4;
const OBJ_RESERVED = 5;
const OBJ_OFS_DELTA = 6;
const OBJ_REF_DELTA = 7;
const types = [
    'invalid',
    'commit',
    'tree',
    'blob',
    'tag',
    'reserved',
    'ofs_delta',
    'ref_delta'
] as const;

// Size of the base object name encoded in ref delta prelude
const oidSize = 20;

const buffers = new Array(5000);
let reuseBufferCount = 0;

// Use FinalizationRegistry to close a file handler owned by a PackContent instance
// once it loses all its references and is collected by GC.
// This fixes Node.js warnings such as "Warning: Closing file descriptor # on garbage collection",
// which is deprecated in Node.js 22 and will result in an error being thrown in the future.
const fileHandlerRegistry = new FinalizationRegistry((fh: fsPromises.FileHandle) => {
    fh.close();
});

export class PackContent {
    static buildReverseIndex(pack: PackContent) {
        const reverseIndex = new Uint32Array(pack.size);

        for (let i = 0; i < pack.size; i++) {
            reverseIndex[i] = i;
        }

        reverseIndex.sort(
            (a, b) => pack.index.getObjectOffsetByIndex(a) - pack.index.getObjectOffsetByIndex(b)
        );

        return new PackReverseIndex(null, pack.filesize, pack.index, reverseIndex);
    }

    cache: Map<number, InternalGitObjectContent>;

    constructor(
        public filename: string,
        public filesize: number,
        public size: number,
        private fh: fsPromises.FileHandle,
        public readObjectHeaderFromAllPacks: ReadObjectHeaderFromAllPacks,
        public readObjectFromAllPacks: ReadObjectFromAllPacks,
        public index: PackIndex,
        public reverseIndex: PackReverseIndex | null
    ) {
        this.cache = new Map();
        fileHandlerRegistry.register(this, fh);
    }

    getObjectOffset(hash: Buffer) {
        return this.index.getObjectOffsetByHash(hash);
    }

    getObjectIndex(hash: Buffer) {
        return this.index.getObjectIndexByHash(hash);
    }

    readObjectHeader(hash: Buffer) {
        const offset = this.getObjectOffset(hash);

        if (offset !== undefined) {
            return this.readObjectHeaderFromFile(offset);
        }

        return this.readObjectHeaderFromAllPacks(hash);
    }

    readObjectHeaderByIndex(index: number) {
        const offset = this.index.getObjectOffsetByIndex(index);

        return this.readObjectHeaderFromFile(offset);
    }

    readObjectByIndex(index: number, cache?: boolean) {
        const offset = this.index.getObjectOffsetByIndex(index);

        return this.readObjectFromFile(offset, cache);
    }

    readObject(hash: Buffer) {
        const offset = this.getObjectOffset(hash);

        if (offset !== undefined) {
            return this.readObjectFromFile(offset);
        }

        return this.readObjectFromAllPacks(hash);
    }

    private read(buffer: Buffer, offset: number) {
        return this.fh.read(buffer, 0, buffer.byteLength, offset);
    }

    private async readObjectPreludeFromFile(offset: number) {
        const header =
            reuseBufferCount > 0 ? buffers[--reuseBufferCount] : Buffer.allocUnsafe(4096);

        await this.read(header, offset);

        const reader = new BufferCursor(header);

        // https://git-scm.com/docs/pack-format#_size_encoding
        // n-byte type and length (3-bit type, (n-1)*7+4-bit length) compressed data
        const int = readVarIntLE(reader);
        const btype = ((int >> 4) & 0b0111) as PackedType;
        const length = ((int >> 7) << 4) | (int & 0b1111);

        if (btype === OBJ_INVALID || btype === OBJ_RESERVED) {
            throw new Error(`Unrecognized type: 0b${btype.toString(2)}`);
        }

        let deltaRef: Buffer | number | null = null;

        // Handle deltified objects
        // Both ofs-delta and ref-delta store the "delta" to be applied to another object (called base object)
        // to reconstruct the object. The difference between them is, ref-delta directly encodes base object name.
        // If the base object is in the same pack, ofs-delta encodes the offset of the base object in the pack instead.
        if (btype === OBJ_OFS_DELTA) {
            deltaRef = offset - readEncodedOffset(reader);
        } else if (btype === OBJ_REF_DELTA) {
            deltaRef = Buffer.from(reader.slice(oidSize));
        }

        return {
            btype,
            length,
            reader,
            deltaRef
        };
    }

    async readObjectHeaderFromFile(offset: number) {
        const { btype, length, reader, deltaRef } = await this.readObjectPreludeFromFile(offset);
        let type: Type;

        buffers[reuseBufferCount++] = reader.buffer;

        if (deltaRef !== null) {
            const delta =
                typeof deltaRef === 'number'
                    ? await this.readObjectHeaderFromFile(deltaRef)
                    : await this.readObjectHeaderFromAllPacks(deltaRef);

            if (delta === null) {
                throw new Error('Could not read delta object from packfile');
            }

            type = delta.type;
        } else {
            type = types[btype] as Type;
        }

        const result: InternalGitObjectHeader = {
            type,
            length
        };

        return result;
    }

    async readObjectFromFile(offset: number, cache = true) {
        const cachedResult = this.cache.get(offset);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        const { btype, length, reader, deltaRef } = await this.readObjectPreludeFromFile(offset);
        const header = reader.buffer;
        let type: Type;

        // Handle undeltified objects
        const objSize = length + 32;
        const objOffset = offset + reader.offset;
        const bufferLeft = header.byteLength - reader.offset;
        const buffer =
            bufferLeft >= objSize
                ? header.slice(reader.offset)
                : (await this.read(Buffer.allocUnsafe(objSize), objOffset)).buffer;

        let object = inflateSync(buffer);
        buffers[reuseBufferCount++] = header;

        // Assert that the object lexngth is as expected.
        if (object.byteLength !== length) {
            throw new Error(
                `Packfile told us object would have length ${length} but it had length ${object.byteLength}`
            );
        }

        if (deltaRef !== null) {
            const delta =
                typeof deltaRef === 'number'
                    ? await this.readObjectFromFile(deltaRef, cache)
                    : await this.readObjectFromAllPacks(deltaRef, cache);

            if (delta === null) {
                throw new Error('Could not read delta object from packfile');
            }

            type = delta.type;
            object = recostructDeltifiedObject(object, delta.object);
        } else {
            type = types[btype] as Type;
        }

        // result.source = `objects/pack/${packIndex.packFilename}`;
        const result: InternalGitObjectContent = {
            type,
            object
        };

        if (cache) {
            this.cache.set(offset, result);
        }

        return result;
    }

    async objectsStat(): Promise<ObjectsTypeStat[]> {
        const objectsByType = types.map(createObjectsTypeStat);

        if (this.reverseIndex === null) {
            this.reverseIndex = PackContent.buildReverseIndex(this);
        }

        // we read file in chunks to not run into memory issues on big files, current chunk is stored in this buffer
        const readBuffer = Buffer.allocUnsafe(4 * 1024 * 1024);
        const reader = new BufferCursor(readBuffer);

        // offset of the first object in pack file
        let nextOffset = this.index.getObjectOffsetByIndex(
            this.reverseIndex.indexByOffsetToIndexByName(0)
        );

        reader.offset = readBuffer.byteLength;

        // offsetBase - offset within the pack file
        for (let i = 0, offsetBase = 0; i < this.index.size; i++) {
            const offset = nextOffset;
            // an offset within a chunk of pack file that currently loaded in readBuffer
            const relOffset = offset - offsetBase;

            nextOffset =
                i < this.index.size - 1
                    ? this.index.getObjectOffsetByIndex(
                          this.reverseIndex.indexByOffsetToIndexByName(i)
                      )
                    : this.filesize - 20; // checks if there's more to read (20 is size of the file ender)

            // 32 bytes is a guesstimate on data size that for sure contains object's type & length header
            // if there's less data in the buffer, we read more from the file
            if (relOffset > reader.bytesLeft - 32) {
                await this.read(readBuffer, offset);
                reader.offset = 0;
                offsetBase = offset;
            } else {
                reader.offset = relOffset;
            }

            // n-byte type and length (3-bit type, (n-1)*7+4-bit length) compressed data
            // https://git-scm.com/docs/pack-format#_size_encoding
            const int = readVarIntLE(reader);
            const btype = ((int >> 4) & 0b0111) as PackedType;
            const length = ((int >> 7) << 4) | (int & 0b1111);

            objectsByType[btype].count++;
            objectsByType[btype].size += nextOffset - offset;
            objectsByType[btype].unpackedSize += length;

            if (btype !== OBJ_OFS_DELTA && btype !== OBJ_REF_DELTA) {
                continue;
            }

            if (btype === OBJ_OFS_DELTA) {
                // skip offset part for ofs delta
                readEncodedOffset(reader);
            } else {
                // skip oid part for ref delta
                reader.offset += oidSize;
            }

            const chunkSize = 512;
            let objectBuffer: Buffer;
            if (reader.bytesLeft >= chunkSize) {
                objectBuffer = reader.slice(chunkSize);
            } else {
                objectBuffer = Buffer.allocUnsafe(chunkSize);
                await this.read(objectBuffer, offsetBase + reader.offset);
            }

            const inflatedObjectBuffer = inflateSync(objectBuffer);
            const objectReader = new BufferCursor(inflatedObjectBuffer);

            // The delta data starts with the size of the base object and the size of the object to be reconstructed.
            // Read object's base size to move cursor to object's recosntructed size
            readVarIntLE(objectReader);
            const resultSize = readVarIntLE(objectReader);

            objectsByType[btype].unpackedRestoredSize += resultSize;
        }

        return objectsByType.filter((stat) => stat.count > 0);
    }

    close() {
        this.fh.close();
    }
}

export async function readPackFile(
    gitdir: string,
    packFilename: string,
    readObjectHeaderFromAllPacks: ReadObjectHeaderFromAllPacks,
    readObjectFromAllPacks: ReadObjectFromAllPacks
) {
    const fullPackFilename = pathJoin(gitdir, packFilename);
    const packFilesize = (await fsPromises.stat(fullPackFilename)).size;
    const fh = await fsPromises.open(fullPackFilename);
    const header = Buffer.allocUnsafe(12);

    await fh.read(header, 0, 12, 0);

    // 4-byte signature: The signature is: {'P', 'A', 'C', 'K'}
    // 4-byte version number (network byte order):
    //   Git currently accepts version number 2 or 3 but generates version 2 only.
    checkFileHeader(fullPackFilename, header, Buffer.from('PACK'), 2);

    // 4-byte number of objects contained in the pack (network byte order)
    const size = header.readUint32BE(8);

    // Prepare indexes
    const index = await readPackIdxFile(gitdir, packFilename);
    const reverseIndex = await readPackRevFile(gitdir, packFilename, packFilesize, index);

    // Combine all together
    return new PackContent(
        packFilename,
        packFilesize,
        size,
        fh,
        readObjectHeaderFromAllPacks,
        readObjectFromAllPacks,
        index,
        reverseIndex
    );
}
