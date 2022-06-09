import { Author, AnnotatedTag, Commit, Tree } from './types';

// The amount of effort that went into crafting these cases to handle
// -0 (just so we don't lose that information when parsing and reconstructing)
// but can also default to +0 was extraordinary.
function parseTimezoneOffset(offset: string) {
    const [, sign, hours, minutes] = offset.match(/(\+|-)(\d\d)(\d\d)/) || [];
    const norm = (sign === '+' ? 1 : -1) * (Number(hours) * 60 + Number(minutes));
    return norm === 0 ? norm : -norm;
}

function parseAuthor(input: string): Author {
    const [, name, email, timestamp, offset] = input.match(/^(.*) <(.*)> (.*) (.*)$/) || [];
    return {
        name: name,
        email: email,
        timestamp: Number(timestamp),
        timezoneOffset: parseTimezoneOffset(offset)
    };
}

export function parseAnnotatedTag(object: Buffer) {
    const content = object.toString('utf8');
    const headersEnd = content.indexOf('\n\n');
    const result = parseAnnotatedTagHeaders(content.slice(0, headersEnd));

    result.message = content.slice(headersEnd + 2);

    const gpgsigOffset = result.message.indexOf('-----BEGIN PGP SIGNATURE-----');
    if (gpgsigOffset !== -1) {
        result.gpgsig = result.message.slice(gpgsigOffset);
        result.message = result.message.slice(0, gpgsigOffset - 1);
    }

    return result as AnnotatedTag;
}

function parseAnnotatedTagHeaders(header: string) {
    const hs: string[] = [];

    for (const line of header.split('\n')) {
        if (line[0] === ' ') {
            // combine with previous header (without space indent)
            hs[hs.length - 1] += '\n' + line.slice(1);
        } else {
            hs.push(line);
        }
    }

    const obj: Record<string, string | Author> = Object.create(null);

    for (const h of hs) {
        const spaceIndex = h.indexOf(' ');
        const key = h.slice(0, spaceIndex);
        const value = h.slice(spaceIndex + 1);

        obj[key] = key === 'tagger' ? parseAuthor(value) : value;
    }

    return obj;
}

export function parseCommit(object: Buffer) {
    const content = object.toString('utf8');
    const headersEnd = content.indexOf('\n\n');
    const result = parseCommitHeaders(content.slice(0, headersEnd));

    result.message = content.slice(headersEnd + 2);

    return result as Commit;
}

function parseCommitHeaders(header: string) {
    const hs: string[] = [];

    for (const line of header.split('\n')) {
        if (line[0] === ' ') {
            // combine with previous header (without space indent)
            hs[hs.length - 1] += '\n' + line.slice(1);
        } else {
            hs.push(line);
        }
    }

    const obj: {
        parent: string[];
        [k: string]: any;
    } = Object.create(null);
    obj.parent = [];

    for (const h of hs) {
        const spaceIndex = h.indexOf(' ');
        const key = h.slice(0, spaceIndex);
        const value = h.slice(spaceIndex + 1);

        if (key === 'parent') {
            obj[key].push(value);
        } else {
            obj[key] =
                key === 'author' || key === 'committer' || key === 'tagger'
                    ? parseAuthor(value)
                    : value;
        }
    }

    return obj;
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
