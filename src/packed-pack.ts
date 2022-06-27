import { promises as fsPromises, statSync } from 'fs';
import { inflateSync } from './fast-inflate.js';
import { BufferCursor, checkFileHeader, readEncodedOffset, readVarIntLE } from './utils.js';
import { PackIndex, readPackIdxFile } from './packed-idx.js';
import { PackReverseIndex, readPackRevFile } from './packed-rev.js';
import { recostructDeltifiedObject } from './packed-deltified-object.js';
import { InternalGitObjectContent, InternalGitObjectHeader, ObjectsTypeStat } from './types.js';

export type ReadObjectHeaderFromAllPacks = (
    hash: Buffer,
    exclude?: PackContent | null
) => Promise<InternalGitObjectHeader | null> | null;
export type ReadObjectFromAllPacks = (
    hash: Buffer,
    exclude?: PackContent | null
) => Promise<InternalGitObjectContent | null> | null;

type Type = 'commit' | 'tree' | 'blob' | 'tag';
type PackedType =
    | typeof INVALID
    | typeof COMMIT
    | typeof TREE
    | typeof BLOB
    | typeof RESERVED
    | typeof TAG
    | typeof OFS_DELTA
    | typeof REF_DELTA;

const HEADER_MULTIBYTE_LENGTH = 0b10000000;
const HEADER_TYPE = 0b01110000;
const HEADER_LENGTH = 0b00001111;

const INVALID = 0b0000000;
const COMMIT = 0b0010000;
const TREE = 0b0100000;
const BLOB = 0b0110000;
const RESERVED = 0b1010000;
const TAG = 0b1000000;
const OFS_DELTA = 0b1100000;
const REF_DELTA = 0b1110000;
const types = {
    0b0000000: 'invalid',
    0b0010000: 'commit',
    0b0100000: 'tree',
    0b0110000: 'blob',
    0b1010000: 'reserved',
    0b1000000: 'tag',
    0b1100000: 'ofs_delta',
    0b1110000: 'ref_delta'
} as const;

const buffers = new Array(5000);
let reuseBufferCount = 0;

export class PackContent {
    static buildReverseIndex(pack: PackContent) {
        const uint32View = new Uint32Array(pack.size);
        const reverseIndex = Buffer.from(uint32View.buffer);

        for (let i = 0; i < pack.size; i++) {
            uint32View[i] = i;
        }

        uint32View.sort(
            (a, b) => pack.index.getObjectOffsetByIndex(a) - pack.index.getObjectOffsetByIndex(b)
        );

        for (let i = 0; i < pack.size; i++) {
            reverseIndex.writeUInt32BE(uint32View[i], i * 4);
        }

        return new PackReverseIndex(null, pack.filesize, pack.index, reverseIndex);
    }

    cache: Map<number, InternalGitObjectContent>;
    filesize: number;

    constructor(
        public filename: string,
        public size: number,
        private fh: fsPromises.FileHandle,
        public readObjectHeaderFromAllPacks: ReadObjectHeaderFromAllPacks,
        public readObjectFromAllPacks: ReadObjectFromAllPacks,
        public index: PackIndex,
        public reverseIndex: PackReverseIndex | null
    ) {
        this.cache = new Map();
        this.filesize = statSync(filename).size;
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

        return this.readObjectHeaderFromAllPacks(hash, this);
    }

    readObjectHeaderByIndex(index: number) {
        const offset = this.index.getObjectOffsetByIndex(index);

        return this.readObjectHeaderFromFile(offset);
    }

    readObjectByIndex(index: number) {
        const offset = this.index.getObjectOffsetByIndex(index);

        return this.readObjectFromFile(offset);
    }

    readObject(hash: Buffer) {
        const offset = this.getObjectOffset(hash);

        if (offset !== undefined) {
            return this.readObjectFromFile(offset);
        }

        return this.readObjectFromAllPacks(hash, this);
    }

    private read(buffer: Buffer, offset: number) {
        return this.fh.read(buffer, 0, buffer.byteLength, offset);
    }

    private async readObjectPreludeFromFile(offset: number) {
        const header =
            reuseBufferCount > 0 ? buffers[--reuseBufferCount] : Buffer.allocUnsafe(4096);

        await this.read(header, offset);

        const reader = new BufferCursor(header);

        // n-byte type and length (3-bit type, (n-1)*7+4-bit length) compressed data
        const firstByte = reader.readUInt8();
        const btype = (firstByte & HEADER_TYPE) as PackedType;

        if (btype === INVALID || btype === RESERVED) {
            throw new Error(`Unrecognized type: 0b${btype.toString(2)}`);
        }

        // https://git-scm.com/docs/pack-format#_size_encoding
        let length = firstByte & HEADER_LENGTH;
        if (firstByte & HEADER_MULTIBYTE_LENGTH) {
            length |= readVarIntLE(reader) << 4;
        }

        let deltaRef: Buffer | number | null = null;

        // Handle deltified objects
        // Both ofs-delta and ref-delta store the "delta" to be applied to another object (called base object)
        // to reconstruct the object. The difference between them is, ref-delta directly encodes base object name.
        // If the base object is in the same pack, ofs-delta encodes the offset of the base object in the pack instead.
        if (btype === OFS_DELTA) {
            deltaRef = offset - readEncodedOffset(reader);
        } else if (btype === REF_DELTA) {
            deltaRef = Buffer.from(reader.slice(20));
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
                    : await this.readObjectHeaderFromAllPacks(deltaRef, this);

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

    async readObjectFromFile(offset: number) {
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
                    ? await this.readObjectFromFile(deltaRef)
                    : await this.readObjectFromAllPacks(deltaRef);

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

        this.cache.set(offset, result);

        return result;
    }

    async objectsStat(): Promise<ObjectsTypeStat[]> {
        const objectsByType = Object.fromEntries(
            Object.entries(types).map(([btype, type]) => [
                btype,
                {
                    type,
                    count: 0,
                    size: 0,
                    packedSize: 0
                }
            ])
        );

        if (this.reverseIndex === null) {
            this.reverseIndex = PackContent.buildReverseIndex(this);
        }

        const readBuffer = Buffer.allocUnsafe(4 * 1024 * 1024);
        const reader = new BufferCursor(readBuffer);
        let nextOffset = this.index.getObjectOffsetByIndex(
            this.reverseIndex.indexByOffsetToIndexByName(0)
        );

        reader.offset = readBuffer.byteLength;

        for (let i = 0, offsetBase = 0; i < this.index.size; i++) {
            const offset = nextOffset;
            const relOffset = offset - offsetBase;

            nextOffset =
                i < this.index.size - 1
                    ? this.index.getObjectOffsetByIndex(
                          this.reverseIndex.indexByOffsetToIndexByName(i)
                      )
                    : this.filesize - 20;

            if (relOffset > reader.bytesLeft - 32) {
                await this.read(readBuffer, offset);
                reader.offset = 0;
                offsetBase = offset;
            } else {
                reader.offset = relOffset;
            }

            // n-byte type and length (3-bit type, (n-1)*7+4-bit length) compressed data
            const firstByte = reader.readUInt8();
            const btype = (firstByte & HEADER_TYPE) as PackedType;

            if (btype === INVALID || btype === RESERVED) {
                throw new Error(`Unrecognized type: 0b${btype.toString(2)}`);
            }

            // https://git-scm.com/docs/pack-format#_size_encoding
            let length = firstByte & HEADER_LENGTH;
            if (firstByte & HEADER_MULTIBYTE_LENGTH) {
                length |= readVarIntLE(reader) << 4;
            }

            objectsByType[btype].count++;
            objectsByType[btype].size += length;
            objectsByType[btype].packedSize += nextOffset - offset;
        }

        return Object.values(objectsByType).filter((stat) => stat.count > 0);
    }
}

export async function readPackFile(
    packFilename: string,
    readObjectHeaderFromAllPacks: ReadObjectHeaderFromAllPacks,
    readObjectFromAllPacks: ReadObjectFromAllPacks
) {
    const fh = await fsPromises.open(packFilename);
    const header = Buffer.allocUnsafe(12);

    await fh.read(header, 0, 12, 0);

    // 4-byte signature: The signature is: {'P', 'A', 'C', 'K'}
    // 4-byte version number (network byte order):
    //   Git currently accepts version number 2 or 3 but generates version 2 only.
    checkFileHeader(packFilename, header, Buffer.from('PACK'), 2);

    // 4-byte number of objects contained in the pack (network byte order)
    const size = header.readUint32BE(8);

    // Prepare indexes
    const index = await readPackIdxFile(packFilename);
    const reverseIndex = await readPackRevFile(packFilename, index);

    // Combine all together
    return new PackContent(
        packFilename,
        size,
        fh,
        readObjectHeaderFromAllPacks,
        readObjectFromAllPacks,
        index,
        reverseIndex
    );
}
