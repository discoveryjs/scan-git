import { createInflate, constants, Inflate } from 'zlib';

// This is a tricky solution to re-use an Inflate instance and its context/buffers
// to avoid unnecessary work on init and memory consumption.
// Inspired by: https://github.com/timotejroiko/fast-zlib

// Fixing TypeScript warnings
type PatchedInflate = Inflate & {
    on: any;
    _handle: any;
    _processChunk(data: Buffer, flag: number): Buffer;
    [key: symbol]: any;
};

// Main zlib inflate object
const reusableInflate = createInflate() as PatchedInflate;
const _handle = reusableInflate._handle;
const _kError =
    Object.getOwnPropertySymbols(reusableInflate).find(
        (prop) => prop.toString() === 'Symbol(kError)'
    ) || Symbol();

reusableInflate._handle.close = () => void 0;
reusableInflate.on = () => {}; // prevent adding 'error' listeners on every _processChunk

// export { inflateSync } from 'zlib';
export function inflateSync(data: Buffer) {
    let result;

    // Reset state and restore _handle since it set to null on _processChunk()
    reusableInflate._handle = _handle;
    reusableInflate[_kError] = null;
    reusableInflate.reset();

    result = reusableInflate._processChunk(data, constants.Z_SYNC_FLUSH);
    result = Buffer.from(result);

    return result;
}
