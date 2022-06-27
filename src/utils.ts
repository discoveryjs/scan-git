export function isOid(value: unknown) {
    return typeof value === 'string' && value.length === 40 && /[0-9a-f]{40}/.test(value);
}

// https://git-scm.com/docs/pack-format
// offset encoding: n bytes with MSB set in all but the last one.
// The offset is then the number constructed by
// concatenating the lower 7 bit of each byte, and
// for n >= 2 adding 2^7 + 2^14 + ... + 2^(7*(n-1))
// to the result.
export function readEncodedOffset(reader: BufferCursor) {
    let result = -1;
    let byte = 0;

    do {
        byte = reader.readUInt8();

        // Note: An encoded offset can be greater than int32, so we can't use binary ops
        // for the result to avoid an overflow. As an alternative a BigInt for the result
        // might be used but it involves unwanted BigInt<->Number conversions.
        //
        // The expression is equivalent to:
        //   result = ((result + 1) << 7) | (byte & 0b0111111)
        result = (result + 1) * 128 + (byte & 0b01111111);
    } while (byte & 0b10000000);

    return result;
}

export function readVarIntLE(reader: BufferCursor) {
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

export class BufferCursor {
    #offset = 0;
    constructor(public buffer: Buffer) {}

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

    copyFrom(source: Buffer, sourceStart?: number, sourceEnd?: number) {
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

export function binarySearchUint32(buffer: Buffer, number: number, fn: (value: number) => number) {
    let l = 0;
    let h = buffer.byteLength / 4 - 1;

    while (l <= h) {
        const m = l + ((h - l) >> 1);
        const mo = m * 4;
        const res = number - fn(buffer.readUint32BE(mo));

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

export function checkFileHeader(
    filename: string,
    header: Buffer,
    magick: Buffer,
    expectedVersion: number
) {
    // Check magic signature
    if (header.compare(magick, 0, 4, 0, 4) !== 0) {
        throw new Error(
            `Bad magick 0x${header.toString(
                'hex',
                0,
                4
            )} in ${filename} (expected 0x${magick.toString('hex')})`
        );
    }

    // Check version
    const actualVersion = header.readUInt32BE(4);
    if (actualVersion !== expectedVersion) {
        throw new Error(
            `Bad version "${actualVersion}" in ${filename}. (Only version "${expectedVersion}" is supported)`
        );
    }
}
