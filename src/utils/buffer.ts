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
    offset = 0;
    constructor(public buffer: Buffer) {}

    get eof() {
        return this.offset >= this.buffer.length;
    }
    get bytesLeft() {
        return this.buffer.byteLength - this.offset;
    }

    slice(length: number) {
        return this.buffer.slice(this.offset, (this.offset += length));
    }

    toString(enc: BufferEncoding, length: number) {
        return this.buffer.toString(enc, this.offset, (this.offset += length));
    }

    write(value: string, length: number, enc?: BufferEncoding) {
        const bytesWritten = this.buffer.write(value, this.offset, length, enc);
        this.offset += bytesWritten;
        return bytesWritten;
    }

    copyFrom(source: Buffer, sourceStart?: number, sourceEnd?: number) {
        const copiedBytes = source.copy(this.buffer, this.offset, sourceStart, sourceEnd);

        this.offset += copiedBytes;

        return copiedBytes;
    }

    copyTo(target: Buffer, targetStart = 0, length = this.bytesLeft) {
        const copiedBytes = this.buffer.copy(
            target,
            targetStart,
            this.offset,
            this.offset + length
        );

        this.offset += copiedBytes;

        return copiedBytes;
    }

    readUInt8() {
        const r = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return r;
    }

    readUInt32BE() {
        const r = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return r;
    }
}
