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
        pgpsig: undefined
    };
    const headersEnd = parseAnnotatedTagHeaders(content, tag);

    tag.message = content.slice(headersEnd, -1);

    const gpgsigOffset = tag.message.indexOf('-----BEGIN PGP SIGNATURE-----');
    if (gpgsigOffset !== -1) {
        tag.pgpsig = tag.message.slice(gpgsigOffset);
        tag.message = tag.message.slice(0, gpgsigOffset - 1);
    }

    return tag as AnnotatedTag;
}

function parseAnnotatedTagHeaders(input: string, dict: AnnotatedTag) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset + 1);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof AnnotatedTag;
        const value = input.slice(spaceOffset + 1, lineEndOffset) as AnnotatedTag['type'];

        if (key === 'tagger') {
            dict[key] = parseAuthor(value);
        } else {
            dict[key] = value;
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
        pgpdig: undefined
    } as Commit;

    const content = object.toString('utf8');
    const headersEnd = parseCommitHeaders(content, commit);

    commit.message = content.slice(headersEnd, -1);

    return commit;
}

function parseCommitHeaders(input: string, dict: Commit) {
    let lineEndOffset = 0;
    let lineStartOffset = 0;

    do {
        lineEndOffset = input.indexOf('\n', lineEndOffset + 1);

        if (lineEndOffset === lineStartOffset) {
            break; // empty line is an end of headers
        }

        const spaceOffset = input.indexOf(' ', lineStartOffset + 1);
        const key = input.slice(lineStartOffset, spaceOffset) as keyof Commit;
        const value = input.slice(spaceOffset + 1, lineEndOffset);

        if (key === 'parent') {
            dict[key].push(value);
        } else if (key === 'author' || key === 'committer') {
            dict[key] = parseAuthor(value);
        } else {
            dict[key] = value;
        }

        lineStartOffset = lineEndOffset + 1;
    } while (true);

    return lineEndOffset + 1;
}

export function parseTree(buffer: Buffer, filesWithHash = false) {
    const entries: Tree = [];
    let offset = 0;

    while (offset < buffer.length) {
        // format:
        //   [mode]<space>[path]<nullchar>[oid]
        // modes:
        //   40000  -> 'tree'
        //   100644 -> 'blob'
        //   100755 -> 'blob'
        //   120000 -> 'blob'
        //   160000 -> 'commit'

        const space = buffer.indexOf(32, offset + 5);
        if (space === -1) {
            throw new Error(
                `GitTree: Error parsing buffer at byte location ${offset}: Could not find the next space character.`
            );
        }

        const nullchar = buffer.indexOf(0, space + 1);
        if (nullchar === -1) {
            throw new Error(
                `GitTree: Error parsing buffer at byte location ${offset}: Could not find the next null character.`
            );
        }

        // isTree: mode === "40000", speculate here since only "tree" mode starts with "4"
        const path = buffer.toString('utf8', space + 1, nullchar);
        const isTree = buffer[offset] === 52;

        entries.push(
            isTree
                ? {
                      isTree,
                      path,
                      hash: buffer.slice(nullchar + 1, nullchar + 21)
                  }
                : {
                      isTree,
                      path,
                      hash: filesWithHash ? buffer.slice(nullchar + 1, nullchar + 21) : null
                  }
        );

        offset = nullchar + 21;
    }

    return entries;
}
