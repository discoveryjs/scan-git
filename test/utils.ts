import assert from 'assert';
import { readEncodedOffset, BufferCursor } from '../src/utils/buffer.js';
import { promiseAllThreaded } from '../src/utils/threads.js';

it('readEncodedOffset', () => {
    const buffer = Buffer.from([142, 254, 254, 254, 254, 254, 254, 127]);
    const cursor = new BufferCursor(buffer);

    assert.strictEqual(readEncodedOffset(cursor), Number.MAX_SAFE_INTEGER);
});

it('promiseAllThreaded', async () => {
    const maxThreadCount = 2;
    const queue = [1, 2, 3, 4, 5];
    const asyncFn = async (task: number) => task * 2;

    const result = await promiseAllThreaded(maxThreadCount, queue, asyncFn);

    assert.deepStrictEqual(result, [2, 4, 6, 8, 10]);
});

it('promiseAllThreaded with error', async () => {
    const maxThreadCount = 2;
    const queue = [1, 2, 3, 4, 5];
    const asyncFn = async (task: number) => {
        if (task === 3) {
            throw new Error('Task failed');
        }
        return task * 2;
    };

    try {
        await promiseAllThreaded(maxThreadCount, queue, asyncFn);
        assert.fail('Expected an error');
    } catch (err) {
        assert.strictEqual(err.message, 'Task failed');
    }
});
