export function isOid(value: unknown) {
    return typeof value === 'string' && value.length === 40 && /[0-9a-f]{40}/.test(value);
}

export class BufferCursor {
    #offset = 0;
    constructor(private buffer: Buffer) {}

    eof() {
        return this.#offset >= this.buffer.length;
    }

    get offset() {
        return this.#offset;
    }

    slice(length: number) {
        return this.buffer.slice(this.#offset, (this.#offset += length));
    }

    toString(enc: BufferEncoding, length: number) {
        return this.buffer.toString(enc, this.#offset, (this.#offset += length));
    }

    write(value: string, length: number, enc?: BufferEncoding) {
        const bytesWritten = this.buffer.write(value, this.#offset, length, enc);
        this.#offset += bytesWritten;
        return bytesWritten;
    }

    copy(source: Buffer, sourceStart?: number, sourceEnd?: number) {
        const copiedBytes = source.copy(this.buffer, this.#offset, sourceStart, sourceEnd);
        this.#offset += copiedBytes;
        return copiedBytes;
    }

    readUInt8() {
        const r = this.buffer.readUInt8(this.#offset);
        this.#offset += 1;
        return r;
    }

    readUInt32BE() {
        const r = this.buffer.readUInt32BE(this.#offset);
        this.#offset += 4;
        return r;
    }
}

export function binarySearchHash(hashes: Buffer, hash: Buffer, l: number, h: number) {
    const firstInt32 = hash.readUInt32BE(1);

    while (l <= h) {
        const m = l + ((h - l) >> 1);
        const mo = m * 20;
        const res =
            firstInt32 - hashes.readUInt32BE(mo + 1) || hash.compare(hashes, mo + 5, mo + 20, 5);

        if (res === 0) {
            return m;
        }

        if (res > 0) {
            l = m + 1;
        } else {
            h = m - 1;
        }
    }

    return -1;
}

// console.log(
//   binarySearchHash(
//     Buffer.concat([
//       Buffer.from("8cc2139080c1c9049882ae4c8724e57ba361ca6a", "hex"),
//       Buffer.from("9999139080c1c9049882ae4c8724e57ba361ca6a", "hex"),
//       Buffer.from("e342a27173009ac88cdc2c1dbfa5adf461f22561", "hex"),
//     ]),
//     "e342a27173009ac88cdc2c1dbfa5adf461f22561"
//   )
// );
