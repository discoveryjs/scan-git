import { join as pathJoin } from 'path';
import { promises as fsPromises, statSync } from 'fs';
import { inflateSync as fastInflate } from './fast-inflate.js';
import { binarySearchHash, BufferCursor } from './utils.js';
import { GetExternalRefDelta, InternalGitObjectContent } from './types.js';

type Type = 'commit' | 'tree' | 'blob' | 'tag';
const types: Record<number, string> = {
    0b0010000: 'commit',
    0b0100000: 'tree',
    0b0110000: 'blob',
    0b1000000: 'tag',
    0b1100000: 'ofs_delta',
    0b1110000: 'ref_delta'
} as const;

function decodeVarInt(reader: BufferCursor) {
    let byte = 0;
    let result = -1;

    do {
        byte = reader.readUInt8();
        result = ((result + 1) << 7) | (byte & 0b01111111);
    } while (byte & 0b10000000);

    return result;
}

function readVarIntLE(reader: BufferCursor) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
        byte = reader.readUInt8();
        result |= (byte & 0b01111111) << shift;
        shift += 7;
    } while (byte & 0b10000000);

    return result;
}

function readCompactLE(reader: BufferCursor, flags: number, size: number) {
    let result = 0;
    let shift = 0;

    for (let i = 0; i < size; i++) {
        if (flags & 1) {
            result |= reader.readUInt8() << shift;
        }

        flags >>= 1;
        shift += 8;
    }

    return result;
}

const OP_COPY = 0b10000000;
const OP_SIZE = 0b01110000;
const OP_OFFS = 0b00001111;

function readOp(patchReader: BufferCursor, source: Buffer) {
    const byte = patchReader.readUInt8();

    if (byte & OP_COPY) {
        // copy consists of 4 byte offset, 3 byte size (in LE order)
        const offset = readCompactLE(patchReader, byte & OP_OFFS, 4);
        let size = readCompactLE(patchReader, (byte & OP_SIZE) >> 4, 3);

        // Yup. They really did this optimization.
        if (size === 0) {
            size = 0x10000;
        }

        return source.slice(offset, offset + size);
    }

    // insert
    return patchReader.slice(byte);
}

function applyDelta(delta: Buffer, source: Buffer): Buffer {
    const patchReader = new BufferCursor(delta);
    const sourceSize = readVarIntLE(patchReader);

    if (sourceSize !== source.byteLength) {
        throw new Error(
            `applyDelta expected source buffer to be ${sourceSize} bytes but the provided buffer was ${source.length} bytes`
        );
    }

    const targetSize = readVarIntLE(patchReader);
    const firstOp = readOp(patchReader, source);

    // Speed optimization - return raw buffer if it's just single simple copy
    if (firstOp.byteLength === targetSize) {
        return firstOp;
    }

    // Otherwise, allocate a fresh buffer and slices
    const target = Buffer.allocUnsafe(targetSize);
    const writer = new BufferCursor(target);

    writer.copy(firstOp);

    while (!patchReader.eof()) {
        writer.copy(readOp(patchReader, source));
    }

    if (targetSize !== writer.offset) {
        throw new Error(
            `applyDelta expected target buffer to be ${targetSize} bytes but the resulting buffer was ${writer.offset} bytes`
        );
    }

    return target;
}

class GitPackIndex {
    packFilename: string;
    fh: Promise<fsPromises.FileHandle>;
    cache: Map<number, InternalGitObjectContent>;

    constructor(
        public filename: string,
        public getExternalRefDelta: GetExternalRefDelta,
        public getOffset: (hash: Buffer) => number | undefined
    ) {
        this.packFilename = filename.replace(/\.idx$/, '.pack');
        this.fh = fsPromises.open(this.packFilename);
        this.cache = new Map();
    }

    read(hash: Buffer): Promise<InternalGitObjectContent> {
        const offset = this.getOffset(hash);

        if (offset === undefined) {
            if (this.getExternalRefDelta) {
                return this.getExternalRefDelta(hash.toString('hex')) as any;
            } else {
                throw new Error(`Could not read object ${hash.toString('hex')} from packfile`);
            }
        }

        return this._read(offset);
    }

    async _read(start: number) {
        const cachedResult = this.cache.get(start);
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        const fh = await this.fh;
        const header = Buffer.allocUnsafe(4096);

        await fh.read(header, 0, header.byteLength, start);

        const reader = new BufferCursor(header);
        const byte = reader.readUInt8();

        const btype = byte & 0b01110000;

        let type = types[btype];
        if (type === undefined) {
            throw new Error(`Unrecognized type: 0b${btype.toString(2)}`);
        }

        // The length encoding get complicated.
        // Last four bits of length is encoded in bits 3210
        // Whether the next byte is part of the variable-length encoded number
        // is encoded in bit 7
        let length = byte & 0b00001111;
        const multibyte = byte & 0b10000000;
        if (multibyte) {
            length |= readVarIntLE(reader) << 4;
        }

        let base = null;
        let object = null;

        // Handle deltified objects
        if (type === 'ofs_delta') {
            const offset = decodeVarInt(reader);
            const baseOffset = start - offset;

            ({ object: base, type } = await this._read(baseOffset));
        } else if (type === 'ref_delta') {
            const hash = reader.slice(20);

            ({ object: base, type } = await this.read(hash));
        }

        // Handle undeltified objects
        const objSize = length + 16;
        const objOffset = start + reader.offset;
        const bufferLeft = header.byteLength - reader.offset;
        const buffer =
            bufferLeft >= objSize
                ? header.slice(reader.offset)
                : (await fh.read(Buffer.allocUnsafe(objSize), 0, objSize, objOffset)).buffer;

        object = fastInflate(buffer);

        // Assert that the object length is as expected.
        if (object.byteLength !== length) {
            throw new Error(
                `Packfile told us object would have length ${length} but it had length ${object.byteLength}`
            );
        }

        if (base) {
            object = Buffer.from(applyDelta(object, base));
        }

        // result.source = `objects/pack/${packIndex.packFilename}`;
        const result: InternalGitObjectContent = {
            type: type as Type,
            format: 'content',
            object
        };

        this.cache.set(start, result);

        return result;
    }
}

async function loadPackIndex(filename: string, getExternalRefDelta: GetExternalRefDelta) {
    if ((await fsPromises.stat(filename)).size > 2048 * 1024 * 1024) {
        throw new Error('Packfiles > 2GB is not supported for now');
    }

    let fh: fsPromises.FileHandle | null = null;
    try {
        fh = await fsPromises.open(filename);

        const header = Buffer.allocUnsafe(4 * (2 + 255 + 1));
        const headerSize = header.byteLength;

        await fh.read(header, 0, headerSize);

        // Check for IDX v2 magic number
        if (header.readUInt32BE(0) !== 0xff744f63) {
            throw new Error(`Bad magick 0x${header.toString('hex', 0, 4)} in ${filename}`);
        }

        // version
        const version = header.readUInt32BE(4);
        if (version !== 2) {
            throw new Error(
                `Bad packfile version "${version}" in ${filename}. (Only version 2 is supported)`
            );
        }

        // Get entries count
        const size = header.readUInt32BE(4 * (2 + 255));

        // read hashes & offsets
        const hashes = Buffer.allocUnsafe(20 * size);
        const offsets = Buffer.allocUnsafe(4 * size);

        await fh.read(hashes, 0, hashes.byteLength, headerSize);
        await fh.read(offsets, 0, offsets.byteLength, headerSize + (20 + 4) * size);

        // build fanout table
        const fanoutTable = new Array(256);
        for (let i = 0, prevOffset = 0; i < 256; i++) {
            const offset = header.readUInt32BE(8 + i * 4);

            fanoutTable[i] = [prevOffset, offset];
            prevOffset = offset;
        }

        // api
        const getIdx = (hash: Buffer) => {
            const [start, end] = fanoutTable[hash[0]];
            const idx = start !== end ? binarySearchHash(hashes, hash, start, end - 1) : -1;

            return idx;
        };

        return new GitPackIndex(filename, getExternalRefDelta, (hash: Buffer) => {
            const idx = getIdx(hash);

            return idx !== -1 ? offsets.readUInt32BE(idx * 4) : undefined;
        });
    } finally {
        fh?.close();
    }
}

export async function createPackedObjectIndex(
    gitdir: string,
    getExternalRefDelta: GetExternalRefDelta
) {
    const packdir = pathJoin(gitdir, 'objects/pack');
    const filelist = (await fsPromises.readdir(packdir))
        .filter((filename) => filename.endsWith('.idx'))
        .map((filename) => `${packdir}/${filename}`);

    // sort files in order from youngest to older
    const mtime = filelist.reduce(
        (map, filename) => map.set(filename, statSync(filename).mtime),
        new Map()
    );

    const packIndecies = await Promise.all(
        filelist
            .sort((a, b) => mtime.get(b) - mtime.get(a))
            .map((filename) => loadPackIndex(filename, getExternalRefDelta))
    );

    // process.on("exit", () => {
    //   packIndecies.forEach(pi =>
    //     console.log(
    //       pi.used || "----",
    //       path.basename(pi.filename),
    //       pi.offsets.size
    //     )
    //   );
    // });

    const readByHash = (hash: Buffer) => {
        for (const packedObjectIndex of packIndecies) {
            const offset = packedObjectIndex.getOffset(hash);

            if (offset !== undefined) {
                return packedObjectIndex._read(offset);
            }
        }

        return null;
    };

    return {
        readByHash,
        readByOid(oid: string) {
            return readByHash(Buffer.from(oid, 'hex'));
        }
    };
}
