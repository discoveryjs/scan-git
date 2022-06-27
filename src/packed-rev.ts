import { existsSync, promises as fsPromises } from 'fs';
import { PackIndex } from './packed-idx.js';
import { binarySearchUint32, checkFileHeader } from './utils.js';

export class PackReverseIndex {
    filesize: number;

    constructor(
        public filename: string | null,
        private packSize: number,
        private index: PackIndex,
        private reverseIndex: Buffer
    ) {
        this.filesize = this.filename !== null ? reverseIndex.byteLength + 12 + 20 : 0;
    }

    indexByOffsetToIndexByName(index: number) {
        return this.reverseIndex.readUint32BE(index * 4);
    }
    getObjectIndexByOffset(offset: number) {
        return binarySearchUint32(this.reverseIndex, offset);
    }
    getSizeByIndex(index: number) {
        const objectOffset = this.index.getObjectOffsetByIndex(index);
        const nextObjectOffset =
            index < this.index.size - 1
                ? this.index.getObjectOffsetByIndex(this.reverseIndex[index + 1])
                : this.packSize;

        return nextObjectOffset - objectOffset;
    }
}

export async function readPackRevFile(packFilename: string, packIndex: PackIndex) {
    const revFilename = packFilename.replace(/\.pack$/, '.rev');
    let fh: fsPromises.FileHandle | null = null;

    if (existsSync(revFilename)) {
        try {
            const packSize = (await fsPromises.stat(packFilename)).size - 20; // 20bytes for trailer

            // https://git-scm.com/docs/pack-format#_pack_rev_files_have_the_format
            fh = await fsPromises.open(revFilename);

            const buffer = Buffer.allocUnsafe(12 + 4 * packIndex.size);
            await fh.read(buffer, 0, buffer.byteLength, 0);
            fh.close();

            // A 4-byte magic number 0x52494458 (RIDX).
            // A 4-byte version identifier (= 1).
            checkFileHeader(revFilename, buffer, Buffer.from('RIDX'), 1);

            // A 4-byte hash function identifier (= 1 for SHA-1, 2 for SHA-256).
            // do nothing for now

            // Skip header and store as reverseIndex
            const reverseIndex = buffer.slice(12);

            return new PackReverseIndex(revFilename, packSize, packIndex, reverseIndex);
        } finally {
            fh?.close();
            fh = null;
        }
    }

    return null;
}
