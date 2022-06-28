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
