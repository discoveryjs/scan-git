import { Contributor, AnnotatedTag, Commit, Tree, TreeDiff } from './types';

const NULL_CONTRIBUTOR: Contributor = {
    name: 'Unknown',
    email: 'unknown@unknown.com',
    timestamp: 0,
    timezone: '+0000'
};

// The amount of effort that went into crafting these cases to handle
// -0 (just so we don't lose that information when parsing and reconstructing)
// but can also default to +0 was extraordinary.
export function parseTimezoneOffset(offset: string) {
    const [, sign, hours, minutes] = offset.match(/([+|-])(\d\d)(\d\d)/) || [];
    const norm = (sign === '+' ? 1 : -1) * (Number(hours) * 60 + Number(minutes));
    return norm === 0 ? norm : -norm;
}

export function parseContributor(input: string): Contributor {
    const [, name, email, timestamp, timezone] = input.match(/^(.*) <(.*)> (\d*) (\S*)$/) || [];

    return {
        name,
        email,
        timestamp: parseInt(timestamp, 10),
        timezone
    };
}

export function parseAnnotatedTag(object: Buffer) {
    const content = object.toString('utf8');
    const tag: AnnotatedTag = {
        tag: '',
        type: 'tag',
        object: '',
        tagger: NULL_CONTRIBUTOR,
        message: '',
        gpgsig: undefined
    };
    const headersEnd = parseAnnotatedTagHeaders(content, tag);

    tag.message = content.slice(headersEnd, -1);

    const gpgsigOffset = tag.message.indexOf('-----BEGIN PGP SIGNATURE-----');
    if (gpgsigOffset !== -1) {
        tag.gpgsig = tag.message.slice(gpgsigOffset);
        tag.message = tag.message.slice(0, gpgsigOffset - 1);
    }

    return tag as AnnotatedTag;
}

function parseAnnotatedTagHeaders(input: string, tag: AnnotatedTag) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;
    let prevKey: keyof AnnotatedTag = 'message';

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        if (lineEndOffset === -1) {
            lineEndOffset = input.length;
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof AnnotatedTag | '';
        const value = input.slice(spaceOffset + 1, lineEndOffset) as AnnotatedTag['type'];

        if (key === '') {
            tag[prevKey] += '\n' + value;
        } else if (key === 'tagger') {
            tag[key] = parseContributor(value);
        } else {
            tag[key] = value;
            prevKey = key;
        }

        lineStartOffset = lineEndOffset + 1;
    } while (lineStartOffset < input.length);

    return lineEndOffset + 1;
}

export function parseCommit(object: Buffer) {
    const commit = {
        tree: '',
        parent: [],
        author: NULL_CONTRIBUTOR,
        committer: NULL_CONTRIBUTOR,
        message: '',
        gpgsig: undefined
    } as Commit;

    const content = object.toString('utf8');
    const headersEnd = parseCommitHeaders(content, commit);

    commit.message = content.slice(headersEnd, -1);

    return commit;
}

function parseCommitHeaders(input: string, commit: Commit) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;
    let prevKey: keyof Commit = 'message';

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        if (lineEndOffset === -1) {
            lineEndOffset = input.length;
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof Commit | '';
        const value = input.slice(spaceOffset + 1, lineEndOffset);

        if (key === '') {
            commit[prevKey] += '\n' + value;
        } else if (key === 'parent') {
            commit[key].push(value);
        } else if (key === 'author' || key === 'committer') {
            commit[key] = parseContributor(value);
        } else {
            commit[key] = value;
            prevKey = key;
        }

        lineStartOffset = lineEndOffset + 1;
    } while (lineStartOffset < input.length);

    return lineEndOffset + 1;
}

export function parseTree(buffer: Buffer) {
    const entries: Tree = [];
    let offset = 0;

    while (offset < buffer.length) {
        // tree entry format:
        //   [mode] <0x20(space)> [path] <0x00(nullchar)> [oid]
        const space = buffer.indexOf(32, offset + 5);
        const nullchar = buffer.indexOf(0, space + 1);

        // when mode starts with "4" it's a dir (tree)
        // see: https://github.com/git/git/blob/142430338477d9d1bb25be66267225fb58498d92/compat/vcbuild/include/unistd.h#L74
        const isTree = buffer[offset] === 52; // '4'.charCodeAt() === 52

        entries.push({
            isTree,
            path: buffer.toString('utf8', space + 1, nullchar),
            hash: buffer.slice(nullchar + 1, nullchar + 21)
        });

        offset = nullchar + 21;
    }

    return entries;
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
