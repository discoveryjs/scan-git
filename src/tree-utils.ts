import { TreeDiff, TreeEntry } from './types';

export function findTreeEntry(buffer: Buffer, path: string): TreeEntry | null {
    let offset = 0;

    while (offset < buffer.length) {
        const space = buffer.indexOf(32, offset + 5);
        const nullchar = buffer.indexOf(0, space + 1);
        const entryPath = buffer.toString('utf8', space + 1, nullchar);

        if (path === entryPath) {
            return {
                isTree: buffer[offset] === 52, // '4'.charCodeAt() === 52
                path,
                hash: buffer.slice(nullchar + 1, nullchar + 21)
            };
        }

        offset = nullchar + 21;
    }

    return null;
}

export const ADDED = 1;
export const REMOVED = 2;
export const MODIFIED = 3;
export function diffTrees(prev: Buffer, next: Buffer) {
    const diff: TreeDiff = [];
    const prevLength = prev.length;
    const nextLength = next.length;
    let scanMode = true;
    let prevIdx = 0;
    let prevStart = 0;
    let prevStartName = 0;
    let nextIdx = 0;
    let nextStart = 0;
    let nextStartName = 0;

    for (; prevIdx < prevLength && nextIdx < nextLength; prevIdx++, nextIdx++) {
        let prevCh = prev[prevIdx];
        let nextCh = next[nextIdx];

        if (prevCh !== nextCh) {
            if (scanMode) {
                // different modes
                prevIdx = prev.indexOf(32, prevIdx);
                prevStartName = prevIdx + 1;
                nextIdx = next.indexOf(32, nextIdx);
                nextStartName = nextIdx + 1;
                scanMode = false;
            } else {
                // different names
                if (prevCh === 0 && prev[prevStart] === 52) {
                    prevCh = 47; // when entry is a dir compare as ended with '/'
                }

                if (nextCh === 0 && next[nextStart] === 52) {
                    nextCh = 47; // when entry is a dir compare as ended with '/'
                }

                if (prevCh < nextCh) {
                    prevIdx = prev.indexOf(0, prevIdx) + 20; // move to next entry
                    nextIdx = nextStart - 1; // move to entry start

                    diff.push({
                        type: REMOVED,
                        isTree: prev[prevStart] === 52, // '4'.charCodeAt() === 52
                        path: prev.toString('utf8', prevStartName, prevIdx - 20),
                        hash: prev.slice(prevIdx - 19, prevIdx + 1)
                    });

                    prevStart = prevIdx + 1;
                    scanMode = true;
                } else {
                    prevIdx = prevStart - 1; // move to entry start
                    nextIdx = next.indexOf(0, nextIdx) + 20; // more to next entry

                    diff.push({
                        type: ADDED,
                        isTree: next[nextStart] === 52, // '4'.charCodeAt() === 52
                        path: next.toString('utf8', nextStartName, nextIdx - 20),
                        hash: next.slice(nextIdx - 19, nextIdx + 1)
                    });

                    nextStart = nextIdx + 1;
                    scanMode = true;
                }
            }
        } else if (prevCh === 32 && scanMode) {
            prevStartName = prevIdx + 1;
            nextStartName = nextIdx + 1;
            scanMode = false;
        } else if (prevCh === 0) {
            for (let k = 1; k <= 20; k++) {
                if (prev[prevIdx + k] !== next[nextIdx + k]) {
                    // different oids
                    // TODO: implement a really rare case when prev.isTree !== next.isTree
                    diff.push({
                        type: MODIFIED,
                        isTree: next[nextStart] === 52, // '4'.charCodeAt() === 52
                        path: next.toString('utf8', nextStartName, nextIdx),
                        hash: next.slice(nextIdx + 1, nextIdx + 21),
                        prevHash: prev.slice(prevIdx + 1, prevIdx + 21)
                    });
                    break;
                }
            }

            prevIdx += 20;
            prevStart = prevIdx + 1;
            nextIdx += 20;
            nextStart = nextIdx + 1;
            scanMode = true;
        }
    }

    diffTreesRest(diff, REMOVED, prev, prevStart);
    diffTreesRest(diff, ADDED, next, nextStart);

    return diff;
}

function diffTreesRest(
    diff: TreeDiff,
    type: typeof ADDED | typeof REMOVED,
    tree: Buffer,
    offset: number
) {
    while (offset < tree.length) {
        const space = tree.indexOf(32, offset);
        const nullchar = tree.indexOf(0, space + 1);

        diff.push({
            type,
            isTree: tree[offset] === 52,
            path: tree.toString('utf8', space + 1, nullchar),
            hash: tree.slice(nullchar + 1, nullchar + 21)
        });

        offset = nullchar + 21;
    }
}
