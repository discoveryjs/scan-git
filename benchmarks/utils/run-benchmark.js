import * as fs from 'node:fs';
import * as path from 'node:path';
import { fork } from 'node:child_process';
import { scanFs } from '@discoveryjs/scan-fs';
import chalk from 'chalk';
import { collectGarbage, memDelta, traceMem } from './memory-usage.js';
import { outputToReadme, updateReadmeTable } from './readme.js';
import { prettyByteSize } from './pretty-bytes-size.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export function createBenchmark(setup) {
    const tests = Object.create(null);
    const {
        name = 'anonymous-benchmark',
        libs,
        fixtures = [],
        bootstrap = () => {},
        bench = () => {}
    } = setup || {};

    for (const lib of libs) {
        tests[lib] = true;
    }

    return {
        async run(fixtureIndex) {
            const fixture = await resolveFixture(fixtureIndex || process.argv[2] || 0, fixtures);

            // setup output to README
            if (process.env.README) {
                outputToReadme(name, fixture.index);
            }

            const results = await runBenchmark(name, tests, fixture);

            // update benchmark tables
            if (process.env.README) {
                updateReadmeTable(name, fixture.index, fixtures.length, results);
            }

            return results;
        },
        async runTest(testRef, fixtureIndex, output) {
            const libName = tests[testRef] ? testRef : '???';
            const fixture = await resolveFixture(fixtureIndex || process.argv[2] || 0, fixtures);
            const initialState = await bootstrap(libName, fixture);
            let name = libName;

            try {
                const pkg = await import(`${libName}/package.json`);
                name += ` v${pkg.version}`;
            } catch {}

            return runTest(name, () => bench(initialState, fixture), output);
        }
    };
}

async function resolveFixture(fixtureIndex, fixtures) {
    const fixture = fixtureIndex in fixtures ? fixtures[fixtureIndex] : false;

    if (!fixture) {
        console.error('Fixture is not specified!');
        console.error();
        console.error(
            'Run script:',
            chalk.green(`node ${path.relative(process.cwd(), process.argv[1])} [fixture]`)
        );
        console.error();
        console.error(`where ${chalk.yellow('[fixture]')} is a number:`);
        fixtures.forEach((fixture, idx) => console.log(idx, fixture));
        process.exit();
    }

    if (typeof fixture.ensureReady === 'function') {
        await fixture.ensureReady();
    }

    return fixture;
}

export async function runBenchmark(benchmarkName, tests, fixture) {
    const results = [];
    const fixtureSize = (await scanFs({ basedir: fixture.path })).reduce(
        (res, file) => res + fs.statSync(fixture.path + '/' + file.path).size,
        0
    );

    // banner
    console.log('Benchmark:', chalk.green(benchmarkName));
    console.log('Node version:', chalk.green(process.versions.node));
    console.log(
        'Fixture:',
        chalk.green(path.relative(process.cwd(), fixture.path)),
        chalk.yellow(prettyByteSize(fixtureSize))
    );
    console.log();

    // main part
    for (const testName of Object.keys(tests)) {
        results.push(await runTestInChildProcess(testName));
    }
}

export function runTestInChildProcess(testName, argv = process.argv.slice(1)) {
    return new Promise((resolve, reject) => {
        const child = fork(__dirname + '/run-test.js', [testName, ...argv], {
            stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
            execArgv: ['--expose-gc'],
            env: {
                ...process.env,
                FORCE_COLOR: chalk.supportsColor ? chalk.supportsColor.level : 0
            }
        })
            .on('message', resolve)
            .on('error', reject)
            .on('close', (code) => (code ? reject(new Error('Exit code ' + code)) : resolve()));

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    });
}

async function runTest(name, fn, output = true) {
    await collectGarbage();

    const mem = traceMem(10);
    const startCpu = process.cpuUsage();
    const startTime = performance.now();

    try {
        if (output) {
            console.log('#', chalk.cyan(name));
        }

        // run test and catch a result
        // console.profile && console.profile();
        let result = await fn();
        // console.profile && console.profileEnd();

        // compute metrics
        const time = Math.round(performance.now() - startTime);
        const cpu = parseInt(process.cpuUsage(startCpu).user / 1000);
        const currentMem = mem.stop();
        const maxMem = memDelta(mem.base, mem.max);

        await collectGarbage();

        if (output) {
            console.log('time:', time, 'ms');
            console.log(' cpu:', cpu, 'ms');
            console.log('mem impact: ', String(memDelta(currentMem.base)));
            console.log('       max: ', String(maxMem));
            console.log();
        }

        // release mem
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        result = null;
        await collectGarbage();

        // fs.writeFileSync(outputPath('mem-' + name), JSON.stringify(mem.series()));

        return {
            name,
            time,
            cpu,
            rss: maxMem.delta.rss,
            heapTotal: maxMem.delta.heapTotal,
            heapUsed: maxMem.delta.heapUsed,
            external: maxMem.delta.external,
            arrayBuffers: maxMem.delta.arrayBuffers
        };
    } catch (e) {
        mem.stop();

        if (output) {
            console.error(sanitizeErrorOutput(e));
            console.error();
        }

        let code = e.message === 'Invalid string length' ? 'ERR_STRING_TOO_LONG' : e.code || false;

        return {
            name,
            error: e.name + ': ' + e.message,
            code
        };
    }
}

function sanitizeErrorOutput(error) {
    const home = process.cwd();
    const rx = new RegExp(home.replace(/\[\]\(\)\{\}\.\+\*\?/g, '\\$1'), 'g');
    const text = String(error.stack || error);

    return home ? text.replace(rx, '~') : text;
}
