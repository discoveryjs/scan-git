import path from 'node:path';
import fs from 'node:fs';
import { prettyByteSize } from './pretty-bytes-size.js';
import { captureOutput } from './stdio.js';

const ANSI_REGEXP = /([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;
function stripAnsi(str) {
    return str.replace(ANSI_REGEXP, '');
}

export function replaceInReadme(start, end, replace) {
    const filename = path.join(__dirname, '/README.md');
    const content = fs.readFileSync(filename, 'utf8');
    const mstart = content.match(start);

    if (!mstart) {
        throw new Error('No start offset found');
    }

    const startOffset = mstart.index + mstart[0].length;
    const endRegExp = new RegExp(end, (end.flags || '').replace('g', '') + 'g');
    endRegExp.lastIndex = startOffset;
    const mend = endRegExp.exec(content);

    if (!mend) {
        throw new Error('No end offset found');
    }

    const endOffset = mend.index;

    fs.writeFileSync(
        filename,
        content.slice(0, startOffset) +
            (typeof replace === 'function'
                ? replace(content.slice(startOffset, endOffset))
                : replace) +
            content.slice(endOffset),
        'utf8'
    );
}

export function outputToReadme(benchmarkName, fixtureIndex) {
    captureOutput((output) =>
        replaceInReadme(
            new RegExp(`<!--${benchmarkName}-output:${fixtureIndex}-->`),
            new RegExp(`<!--/${benchmarkName}-output:${fixtureIndex}-->`),
            '\n\n```\n' + stripAnsi(output || '').trim() + '\n```\n'
        )
    );
}

export function updateReadmeTable(benchmarkName, fixtureIndex, fixturesCount, results) {
    for (const type of ['time', 'cpu', 'memory']) {
        replaceInReadme(
            new RegExp(`<!--${benchmarkName}-table:${type}-->`),
            new RegExp(`<!--/${benchmarkName}-table:${type}-->`),
            (content) => {
                const lines = content.trim().split(/\n/);
                const current = Object.create(null);
                const newValues = Object.fromEntries(
                    results.map((item) => [
                        item.name,
                        item.error
                            ? item.code || 'ERROR'
                            : type === 'memory'
                            ? prettyByteSize(item.heapUsed + item.external)
                            : item[type] + 'ms'
                    ])
                );

                for (const line of lines.slice(2)) {
                    const cells = line
                        .trim()
                        .replace(/^\|\s*|\s*\|$/g, '')
                        .split(/\s*\|\s*/);
                    current[cells[0]] = cells.slice(1);
                }

                for (const [k, v] of Object.entries(newValues)) {
                    if (k in current === false) {
                        current[k] = [];
                    }
                    current[k][fixtureIndex] = v;
                }

                // normalize
                for (const array of Object.values(current)) {
                    for (let i = 0; i < fixturesCount; i++) {
                        if (!array[i]) {
                            array[i] = '–';
                        }
                    }
                }

                return (
                    '\n' +
                    [
                        ...lines.slice(0, 2),
                        ...Object.entries(current).map(
                            ([k, v]) => '| ' + [k, ...v].join(' | ') + ' |'
                        )
                    ].join('\n') +
                    '\n'
                );
            }
        );
    }
}
