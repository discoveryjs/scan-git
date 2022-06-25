import { BufferCursor, readVarIntLE } from './utils.js';

const OP_COPY_FROM_BASE = 0b10000000;
const OP_COPY_FROM_BASE_SIZE = 0b01110000;
const OP_COPY_FROM_BASE_OFFSET = 0b00001111;
const OP_COPY_FROM_DELTA_SIZE = 0b01111111;

function readCompactLE(reader: BufferCursor, flags: number) {
    let result = 0;
    let shift = 0;

    while (flags !== 0) {
        if (flags & 1) {
            result |= reader.readUInt8() << shift;
        }

        flags >>= 1;
        shift += 8;
    }

    return result;
}

function readOp(patchReader: BufferCursor, base: Buffer) {
    const op = patchReader.readUInt8();

    if (op & OP_COPY_FROM_BASE) {
        // This is the instruction format to copy a byte range from the source object.
        // It encodes the offset to copy from and the number of bytes to copy.
        // Offset and size are in little-endian order.
        // Instruction copy from base consists of 4 byte offset, 3 byte size (in LE order)
        const offset = readCompactLE(patchReader, op & OP_COPY_FROM_BASE_OFFSET);
        let size = readCompactLE(patchReader, (op & OP_COPY_FROM_BASE_SIZE) >> 4);

        // There is another exception: size zero is automatically converted to 0x10000
        if (size === 0) {
            size = 0x10000;
        }

        return base.slice(offset, offset + size);
    }

    // Instruction to add new data
    const size = op & OP_COPY_FROM_DELTA_SIZE;
    return patchReader.slice(size);
}

// https://git-scm.com/docs/pack-format#_deltified_representation
export function recostructDeltifiedObject(delta: Buffer, base: Buffer): Buffer {
    const patchReader = new BufferCursor(delta);

    // The delta data starts with the size of the base object and the size of the object to be reconstructed.
    const baseSize = readVarIntLE(patchReader);
    const resultSize = readVarIntLE(patchReader);

    if (baseSize !== base.byteLength) {
        throw new Error(
            `recostructDeltifiedObject() expected base object to be ${baseSize} bytes but the provided object is ${base.byteLength} bytes`
        );
    }

    const firstOp = readOp(patchReader, base);

    // Perf optimization: return a slice if it's just single simple copy
    if (firstOp.byteLength === resultSize) {
        return Buffer.from(firstOp);
    }

    // Otherwise, allocate a fresh buffer and slices
    const target = Buffer.allocUnsafe(resultSize);
    const writer = new BufferCursor(target);

    writer.copyFrom(firstOp);

    while (!patchReader.eof()) {
        writer.copyFrom(readOp(patchReader, base));
    }

    if (resultSize !== writer.offset) {
        throw new Error(
            `applyDelta expected target buffer to be ${resultSize} bytes but the resulting buffer was ${writer.offset} bytes`
        );
    }

    return target;
}
