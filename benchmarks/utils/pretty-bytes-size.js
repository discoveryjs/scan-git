export function prettyByteSize(size, options) {
    const unit = ['', 'kB', 'MB', 'GB', 'TB'];
    const { base = 1000, signed, precision = 2, pad, preserveZero } = options || {};

    while (Math.abs(size) > base) {
        size /= base;
        unit.shift();
    }

    return (
        (signed && size > 0 ? '+' : '') +
        size.toFixed(unit.length > 2 ? 0 : precision).replace(/\.0+$/, preserveZero ? '$&' : '') +
        unit[0]
    ).padStart(pad || 0);
}
