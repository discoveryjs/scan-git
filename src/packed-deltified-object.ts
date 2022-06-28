import * as assert from 'assert';
import { BufferCursor, readVarIntLE } from './utils.js';

function readCompactLE(reader: BufferCursor, flags: number) {
    let result = 0;

    for (let shift = 0; flags > 0; flags >>= 1, shift += 8) {
        if (flags & 1) {
            result |= reader.readUInt8() << shift;
        }
    }

    return result;
}

// https://git-scm.com/docs/pack-format#_deltified_representation
export function recostructDeltifiedObject(delta: Buffer, base: Buffer): Buffer {
    const deltaReader = new BufferCursor(delta);

    // The delta data starts with the size of the base object
    // and the size of the object to be reconstructed.
    const baseSize = readVarIntLE(deltaReader);
    const resultSize = readVarIntLE(deltaReader);

    assert.strictEqual(
        base.byteLength,
        baseSize,
        'Base object size (in bytes) must be equal to the size declared in delta'
    );

    // Allocate a buffer for the result
    const result = Buffer.allocUnsafe(resultSize);
    let resultBytesWritten = 0;

    while (!deltaReader.eof) {
        const op = deltaReader.readUInt8();

        if (op & 0b1000_0000) {
            // Instruction to copy from base object
            // https://git-scm.com/docs/pack-format#_instruction_to_copy_from_base_object
            //
            // +----------+---------+---------+---------+---------+-------+-------+-------+
            // | 1xxxxxxx | offset1 | offset2 | offset3 | offset4 | size1 | size2 | size3 |
            // +----------+---------+---------+---------+---------+-------+-------+-------+
            //
            // This is the instruction format to copy a byte range from the source object.
            // It encodes the offset to copy from and the number of bytes to copy.
            // Offset and size are in little-endian order.
            // All offset and size bytes are optional. The first seven bits in the first
            // octet determines which of the next seven octets is present (4 bits offset,
            // 3 bits size).
            // There is another exception: size zero is automatically converted to 0x10000
            const offset = readCompactLE(deltaReader, op & 0b1111);
            const size = readCompactLE(deltaReader, (op >> 4) & 0b111) || 0x10000;

            resultBytesWritten += base.copy(result, resultBytesWritten, offset, offset + size);
        } else if (op !== 0) {
            // Instruction to add new data
            // https://git-scm.com/docs/pack-format#_instruction_to_add_new_data
            //
            // +----------+============+
            // | 0xxxxxxx |    data    |
            // +----------+============+
            //
            // The first seven bits of the first octet determines the size of data in bytes.
            // The size must be non-zero.
            //
            // Note: Since MSB is zero there is no need to use a mask for the lower bits.
            resultBytesWritten += deltaReader.copyTo(result, resultBytesWritten, op);
        } else {
            // https://git-scm.com/docs/pack-format#_reserved_instruction
            throw new Error(
                'Reserved instruction 00000000 met while reconstructing a deltified object'
            );
        }
    }

    assert.strictEqual(
        resultBytesWritten,
        resultSize,
        'Reconstructed object size (in bytes) must be equal to the size declared in delta'
    );

    return result;
}
