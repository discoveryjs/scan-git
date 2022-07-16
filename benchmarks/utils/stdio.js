export function captureStdio(stream, buffer) {
    const oldWrite = stream.write;

    stream.write = (chunk, encoding, fd) => {
        buffer.push(chunk);
        return oldWrite.call(stream, chunk, encoding, fd);
    };

    return () => (stream.write = oldWrite);
}

export function captureOutput(callback) {
    let buffer = [];
    const cancelCapture = () => captures.forEach((fn) => fn());
    const captures = [captureStdio(process.stdout, buffer), captureStdio(process.stderr, buffer)];

    process.once('exit', () => {
        cancelCapture();
        callback(buffer.join(''));
        buffer = null;
    });

    return cancelCapture;
}
