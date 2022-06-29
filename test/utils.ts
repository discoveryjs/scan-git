import assert from 'assert';
import { readEncodedOffset, BufferCursor } from '../src/utils/buffer.js';

it('readEncodedOffset', () => {
    const buffer = Buffer.from([142, 254, 254, 254, 254, 254, 254, 127]);
    const cursor = new BufferCursor(buffer);

    assert.strictEqual(readEncodedOffset(cursor), Number.MAX_SAFE_INTEGER);
});
