import { promises as fsPromises } from 'fs';
import { binarySearchHash, checkFileHeader } from './utils.js';

export class PackIndex {
    constructor(
        public filename: string,
        public size: number,
        private fanoutTable: Array<[startIndex: number, endIndex: number]>,
        private hashes: Buffer,
        private offsets: Buffer,
        private largeOffsets: Buffer
    ) {}

    getObjectIndex(hash: Buffer) {
        const [start, end] = this.fanoutTable[hash[0]];

        if (start === end) {
            return -1;
        }

        return binarySearchHash(this.hashes, hash, start, end - 1);
    }

    getObjectOffset(hash: Buffer) {
        const index = this.getObjectIndex(hash);

        if (index !== -1) {
            return this.getObjectOffsetByIndex(index);
        }

        return -1;
    }

    getObjectOffsetByIndex(index: number) {
        const offset = this.offsets.readUInt32BE(index * 4); // index 4-bytes table

        // When msbit is set to 1 then offset is an index for largeOffsets table
        if (offset & 0x80000000) {
            const largeOffsetIdx = (offset & 0x7fffffff) * 8; // index 8-bytes table
            const largeOffset = this.largeOffsets.readBigInt64BE(largeOffsetIdx);

            // Convert bigint->number to avoid BigInt spread,
            // since any reasonable offset is for sure less then MAX_SAFE_INTEGER
            return Number(largeOffset);
        }

        return offset;
    }
}

export async function readPackIdxFile(packFilename: string) {
    const idxFilename = packFilename.replace(/\.pack$/, '.idx');
    let fh: fsPromises.FileHandle | null = null;
    let readOffset = 0;

    try {
        fh = await fsPromises.open(idxFilename);

        // https://git-scm.com/docs/pack-format#_version_2_pack_idx_files_support_packs_larger_than_4_gib_and
        // Version 2 pack-*.idx files format:
        //   A 4-byte magic number \377tOc which is an unreasonable fanout[0] value.
        //   A 4-byte version number (= 2)
        //   A 256-entry fan-out table just like v1.
        const header = Buffer.allocUnsafe(4 + 4 + 256 * 4);

        await fh.read(header, 0, header.byteLength, readOffset);
        readOffset += header.byteLength;

        // Check magic number for IDX v2 (\377tOc)
        checkFileHeader(idxFilename, header, Buffer.from('\xfftOc', 'latin1'), 2); // \377 === \xff

        // Build fanout table as a range [startIndex, endIndex]
        const fanoutTable = new Array<[number, number]>(256);
        for (let i = 0, startIndex = 0; i < 256; i++) {
            const endIndex = header.readUInt32BE(8 + i * 4);

            fanoutTable[i] = [startIndex, endIndex];
            startIndex = endIndex;
        }

        // End index of last fanout-table element is a entries count
        const size = fanoutTable[255][1];

        // A table of sorted object names
        const hashes = Buffer.allocUnsafe(20 * size);

        await fh.read(hashes, 0, hashes.byteLength, readOffset);
        readOffset += hashes.byteLength;
        readOffset += size * 4; // skip: A table of 4-byte CRC32 values of the packed object data

        // A table of 4-byte offset values (in network byte order). These are usually 31-bit pack file offsets,
        // but large offsets are encoded as an index into the next table with the msbit set.
        const offsets = Buffer.allocUnsafe(4 * size);

        await fh.read(offsets, 0, offsets.byteLength, readOffset);
        readOffset += offsets.byteLength;

        // A table of 8-byte offset entries (empty for pack files less than 2 GiB).
        const largeOffsetsSize = (await fsPromises.stat(idxFilename)).size - readOffset - 2 * 20;
        const largeOffsets = Buffer.allocUnsafe(largeOffsetsSize);

        if (largeOffsetsSize > 0) {
            await fh.read(largeOffsets, 0, largeOffsets.byteLength, readOffset);
        }

        return new PackIndex(idxFilename, size, fanoutTable, hashes, offsets, largeOffsets);
    } finally {
        fh?.close();
        fh = null;
    }
}
