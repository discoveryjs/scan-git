const [, , test, testModule, ...rest] = process.argv;

import(testModule).then(async ({ benchmark }) => {
    process.argv = [process.argv[0], testModule, ...rest];
    benchmark.runTest(test).then((res) => {
        if (typeof process.send === 'function') {
            process.send(res);
        }
    });
});
