import { Author, AnnotatedTag, Commit, Tree } from './types';

const NULL_AUTHOR: Author = {
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

function parseAuthor(input: string): Author {
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
        tagger: NULL_AUTHOR,
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

function parseAnnotatedTagHeaders(input: string, dict: AnnotatedTag) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;
    let prevKey: keyof AnnotatedTag = 'message';

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof AnnotatedTag | '';
        const value = input.slice(spaceOffset + 1, lineEndOffset) as AnnotatedTag['type'];

        if (key === '') {
            dict[prevKey] += '\n' + value;
        } else if (key === 'tagger') {
            dict[key] = parseAuthor(value);
        } else {
            dict[key] = value;
            prevKey = key;
        }

        lineStartOffset = lineEndOffset + 1;
    } while (true);

    return lineEndOffset + 1;
}

export function parseCommit(object: Buffer) {
    const commit = {
        tree: '',
        parent: [],
        author: NULL_AUTHOR,
        committer: NULL_AUTHOR,
        message: '',
        gpgsig: undefined
    } as Commit;

    const content = object.toString('utf8');
    const headersEnd = parseCommitHeaders(content, commit);

    commit.message = content.slice(headersEnd, -1);

    return commit;
}

function parseCommitHeaders(input: string, dict: Commit) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;
    let prevKey: keyof Commit = 'message';

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof Commit | '';
        const value = input.slice(spaceOffset + 1, lineEndOffset);

        if (key === '') {
            dict[prevKey] += '\n' + value;
        } else if (key === 'parent') {
            dict[key].push(value);
        } else if (key === 'author' || key === 'committer') {
            dict[key] = parseAuthor(value);
        } else {
            dict[key] = value;
            prevKey = key;
        }

        lineStartOffset = lineEndOffset + 1;
    } while (true);

    return lineEndOffset + 1;
}

export function parseTree(buffer: Buffer) {
    const entries: Tree = [];
    let offset = 0;

    while (offset < buffer.length) {
        // tree entry format:
        //   [mode]<0x20(space)>[path]<0x00(nullchar)>[oid]
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
