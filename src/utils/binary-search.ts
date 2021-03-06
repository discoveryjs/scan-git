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

export function binarySearchUint32(
    buffer: Buffer,
    value: number,
    readValueByOffset = (index: number) => buffer.readUint32BE(index)
) {
    let l = 0;
    let h = buffer.byteLength / 4 - 1;

    while (l <= h) {
        const m = l + ((h - l) >> 1);
        const mo = m * 4;
        const res = value - readValueByOffset(mo);

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
