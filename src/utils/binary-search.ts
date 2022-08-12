export function binarySearchHash(names: Buffer, hash: Buffer, l: number, h: number) {
    const firstUInt32 = hash.readUInt32BE(1);

    while (l <= h) {
        const m = l + ((h - l) >> 1);
        const mo = m * 20;
        const res =
            firstUInt32 - names.readUInt32BE(mo + 1) || hash.compare(names, mo + 5, mo + 20, 5);

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

export function binarySearchUint32(array: Uint32Array, value: number) {
    let l = 0;
    let h = array.byteLength / 4 - 1;

    while (l <= h) {
        const m = l + ((h - l) >> 1);
        const res = value - array[m];

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
