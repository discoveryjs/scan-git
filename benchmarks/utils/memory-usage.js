import chalk from 'chalk';
import { prettyByteSize } from './pretty-bytes-size.js';

async function timeout(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

export function memDelta(baseline, current, skip = ['arrayBuffers']) {
    const delta = {};
    const base = { ...baseline };

    if (!current) {
        current = process.memoryUsage();
    }

    for (const [k, v] of Object.entries(current)) {
        base[k] = base[k] || 0;
        delta[k] = v - base[k];
    }

    return {
        base,
        current,
        delta,
        toString() {
            const res = [];

            for (const [k, v] of Object.entries(delta)) {
                if (skip.includes(k)) {
                    continue;
                }

                const rel = baseline && k in baseline;
                res.push(
                    `${k} ${(rel && v > 0 ? chalk.yellow : chalk.green)(
                        prettyByteSize(v, { signed: rel, pad: 9, preserveZero: true })
                    )}`
                );
            }

            return res.join(' | ') || 'No changes';
        }
    };
}

export function traceMem(resolutionMs, sample = false) {
    const base = process.memoryUsage();
    const max = { ...base };
    const startTime = Date.now();
    const samples = [];
    const takeSample = () => {
        const mem = process.memoryUsage();

        if (sample) {
            samples.push({
                time: Date.now() - startTime,
                mem
            });
        }

        for (let key in base) {
            if (max[key] < mem[key]) {
                max[key] = mem[key];
            }
        }
    };
    const timer = setInterval(
        takeSample,
        isFinite(resolutionMs) && parseInt(resolutionMs) > 0 ? parseInt(resolutionMs) : 16
    );

    return {
        base,
        max,
        get current() {
            return memDelta(base);
        },
        series(abs) {
            const series = Object.create(null);
            const keys = Object.keys(base);

            for (const key of keys) {
                series[key] = {
                    name: key,
                    data: new Array(samples.length)
                };
            }

            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];

                for (const key of keys) {
                    series[key].data[i] = abs
                        ? sample.mem[key] || 0
                        : sample.mem[key]
                        ? sample.mem[key] - base[key]
                        : 0;
                }
            }

            return {
                time: samples.map((s) => s.time),
                series: Object.values(series)
            };
        },
        stop() {
            clearInterval(timer);
            takeSample();
            return memDelta(base);
        }
    };
}

let exposeGcWarningShowed = false;
export async function collectGarbage() {
    if (typeof global.gc === 'function') {
        global.gc();

        // double sure
        await timeout(100);
        global.gc();
    } else if (!exposeGcWarningShowed) {
        exposeGcWarningShowed = true;
        console.warn(
            chalk.magenta(
                'Looks like script is forcing GC to collect garbage, but corresponding API is not enabled'
            )
        );
        console.warn(
            chalk.magenta(
                'Run node with --expose-gc flag to enable API and get precise measurements'
            )
        );
    }
}
