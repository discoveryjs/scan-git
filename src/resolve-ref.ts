import { promises as fsPromises, existsSync } from 'fs';
import { join as pathJoin, basename, sep as pathSep } from 'path';
import { scanFs } from '@discoveryjs/scan-fs';

type Ref = {
    name: string;
    oid: string;
};
type RefSourceInfo = {
    ref: string | null;
    oid: string | null;
};
type LooseRefFile = {
    path: string;
    content: string | null;
};
type RefResolver = {
    remotes: string[];
    names: string[];
    exists(ref: string): boolean;
    resolveOid(ref: string): Promise<string>;
    resolve(ref: string): Promise<RefSourceInfo>;
};
type RefInfo = {
    path: string;
    name: string;
    symbolic: boolean;
    scope: string;
    namespace: string;
    category: string;
    remote: string | null;
    ref: string | null;
    oid: string | null;
};

// NOTICE: Don't forget to update README.md when change the values
const symbolicRefs = new Set(['HEAD', 'FETCH_HEAD', 'CHERRY_PICK_HEAD', 'MERGE_HEAD', 'ORIG_HEAD']);

// https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions
const refpaths = (ref: string) => [
    `refs/${ref}`,
    `refs/tags/${ref}`,
    `refs/heads/${ref}`,
    `refs/remotes/${ref}`,
    `refs/remotes/${ref}/HEAD`
];

function isOid(value: unknown) {
    return typeof value === 'string' && value.length === 40 && /^[0-9a-f]{40}$/.test(value);
}

export async function createRefIndex(gitdir: string) {
    const refResolver = await createRefResolver(gitdir);

    // expand a ref into a full form
    const expandRef = (ref: string) => {
        if (refResolver.exists(ref)) {
            return ref;
        }

        // Look in all the proper paths, in this order
        for (const candidateRef of refpaths(ref)) {
            if (refResolver.exists(candidateRef)) {
                return candidateRef;
            }
        }

        // Nothing found
        return null;
    };
    const resolveRef = async (ref: string): Promise<string> => {
        // Is it a complete and valid SHA?
        if (isOid(ref)) {
            return ref;
        }

        const expandedRef = expandRef(ref);

        if (expandedRef === null) {
            throw new Error(`Reference "${ref}" is not found`);
        }

        return refResolver.resolveOid(expandedRef);
    };
    const describeRef = async (ref: string): Promise<RefInfo> => {
        const expandedRef = expandRef(ref);

        if (expandedRef === null) {
            throw new Error(`Reference "${ref}" is not found`);
        }

        const refInfo = await refResolver.resolve(expandedRef);

        const [, scope, path] = expandedRef.match(/^([^/]+\/[^/]+)\/(.+)$/) || [
            '',
            'refs/heads',
            expandedRef
        ];
        const [namespace, category] = scope.split('/');
        const remoteMatch = scope === 'refs/remotes' ? path.match(/^([^/]+)\/(.+)$/) : null;
        const [remote = null, name] = remoteMatch ? remoteMatch.slice(1) : [null, path];

        return {
            path: expandedRef,
            name,
            symbolic: symbolicRefs.has(name),
            scope,
            namespace,
            category,
            remote,
            ref: refInfo.ref,
            oid: refInfo.oid
        } satisfies RefInfo;
    };

    const listRemotes = () => refResolver.remotes.slice();

    // List all the refs that match the prefix
    const listRefsCache = new Map<string, string[]>();
    const listRefsWithOidCache = new Map<string, Ref[]>();
    const listRefs = async (prefix: string, withOid: boolean) => {
        let cachedRefs = listRefsCache.get(prefix);

        if (cachedRefs === undefined) {
            // all refs filtered by a prefix
            cachedRefs = refResolver.names
                .filter((name) => name.startsWith(prefix))
                .map((name) => name.slice(prefix.length));

            listRefsCache.set(prefix, cachedRefs);
        }

        if (!withOid) {
            return cachedRefs.slice();
        }

        let cachedRefsWithOid = listRefsWithOidCache.get(prefix);

        if (cachedRefsWithOid === undefined) {
            const oids = await Promise.all(
                cachedRefs.map((name) => refResolver.resolveOid(prefix + name))
            );

            cachedRefsWithOid = cachedRefs.map((name, index) => ({
                name,
                oid: oids[index]
            }));

            listRefsWithOidCache.set(prefix, cachedRefsWithOid);
        }

        return cachedRefsWithOid.map((ref) => ({ ...ref }));
    };

    const listRemoteBranches = (remote: string, withOids = false) =>
        listRefs(`refs/remotes/${remote}/`, withOids);
    const listBranches = (withOids = false) => listRefs('refs/heads/', withOids);
    const listTags = (withOids = false) => listRefs('refs/tags/', withOids);
    const readRefContent = async (ref: string) =>
        basename(
            (await fsPromises.readFile(pathJoin(gitdir, ref), 'utf8'))
                .trim()
                .replace(/^ref:\s*/, '')
        );

    return {
        isOid,
        isRefExists: (ref: string) => expandRef(ref) !== null,
        resolveRef,
        expandRef: (ref: string) => (isOid(ref) ? ref : expandRef(ref)),
        describeRef,

        listRemotes,
        listRemoteBranches,
        listBranches,
        listTags,

        // inspired by https://usethis.r-lib.org/reference/git-default-branch.html
        async defaultBranch() {
            const branches = (await listBranches()) as string[]; // FIXME: remove string[]

            if (branches.length === 1) {
                return basename(branches[0]);
            }

            const branchRef =
                expandRef('refs/remotes/upstream/HEAD') ||
                expandRef('refs/remotes/origin/HEAD') ||
                expandRef('refs/heads/main') ||
                expandRef('refs/heads/master');

            if (branchRef) {
                return branchRef.endsWith('/HEAD')
                    ? readRefContent(branchRef)
                    : basename(branchRef);
            }

            return null;
        },

        async stat() {
            const remotes = listRemotes();
            const branchesByRemote = await Promise.all(
                remotes.map((remote) => listRemoteBranches(remote))
            );

            return {
                remotes: remotes.map((remote, idx) => ({
                    remote,
                    branches: branchesByRemote[idx]
                })),
                branches: await listBranches(),
                tags: await listTags()
            };
        }
    };
}

async function resolveRef(
    ref: string,
    resolvedRefs: Map<string, RefSourceInfo>,
    looseRefs: Map<string, LooseRefFile>
): Promise<RefSourceInfo> {
    let resolvedRef = resolvedRefs.get(ref);

    if (resolvedRef === undefined) {
        const looseRef = looseRefs.get(ref);

        if (looseRef !== undefined) {
            if (looseRef.content === null) {
                looseRef.content = (await fsPromises.readFile(looseRef.path, 'utf8')).trim();
            }

            let refValue = looseRef.content;

            while (!isOid(refValue)) {
                // Is it a ref pointer?
                if (refValue.startsWith('ref: ')) {
                    refValue = refValue.replace(/^ref:\s+/, '');
                    continue;
                }

                // Sometimes an additional information is appended such as tags, branch names or comments
                const spaceIndex = refValue.search(/\s/);
                if (spaceIndex !== -1) {
                    refValue = refValue.slice(0, spaceIndex);
                    continue;
                }

                break;
            }

            const oid = isOid(refValue)
                ? refValue
                : (await resolveRef(refValue, resolvedRefs, looseRefs)).oid;

            resolvedRef = {
                ref: refValue !== oid ? refValue : null,
                oid
            };
        } else {
            resolvedRef = { ref: null, oid: null };
        }

        resolvedRefs.set(ref, resolvedRef);
    }

    if (resolvedRef.oid !== null) {
        return resolvedRef;
    }

    throw new Error(`Reference "${ref}" can't be resolved into oid`);
}

async function createRefResolver(gitdir: string) {
    const resolvedRefs = new Map<string, RefSourceInfo>();
    const refNames = new Set<string>();
    const remotes = await readRemotes(gitdir);
    const [packedRefs, looseRefs] = await Promise.all([
        readPackedRefs(gitdir),
        readLooseRefs(gitdir, remotes)
    ]);

    for (const ref of looseRefs.keys()) {
        refNames.add(ref);
    }

    for (const ref of packedRefs.keys()) {
        if (!ref.endsWith('^{}') && !refNames.has(ref)) {
            const oid = packedRefs.get(ref);

            if (oid !== undefined) {
                resolvedRefs.set(ref, { ref: null, oid });
            }

            refNames.add(ref);
        }
    }

    return {
        remotes,
        names: [...refNames].sort((a, b) => (a < b ? -1 : 1)),
        exists: (ref: string) => refNames.has(ref),
        resolveOid: async (ref: string) =>
            (await resolveRef(ref, resolvedRefs, looseRefs)).oid as string,
        resolve: (ref: string) => resolveRef(ref, resolvedRefs, looseRefs)
    } satisfies RefResolver;
}

async function readRemotes(gitdir: string) {
    const remotesDir = pathJoin(gitdir, 'refs', 'remotes');
    const remotes = [];

    if (existsSync(remotesDir)) {
        const entries = await fsPromises.readdir(remotesDir, {
            withFileTypes: true
        });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                remotes.push(entry.name);
            }
        }
    }

    return remotes.sort();
}

async function readLooseRefs(gitdir: string, remotes: string[]) {
    const looseRefs = new Map<string, LooseRefFile>();
    const include = [
        'refs/heads',
        'refs/tags',
        ...remotes.map((remote) => `refs/remotes/${remote}`)
    ].filter((path) => existsSync(pathJoin(gitdir, path.replace(/\//g, pathSep))));

    if (include.length) {
        const { files } = await scanFs({
            basedir: gitdir,
            include
        });

        for (const { posixPath, path } of files) {
            looseRefs.set(posixPath, { path: pathJoin(gitdir, path), content: null });
        }
    }

    for (const ref of symbolicRefs) {
        const filename = pathJoin(gitdir, ref);

        if (existsSync(filename)) {
            looseRefs.set(ref, { path: filename, content: null });
        }
    }

    return looseRefs;
}

async function readPackedRefs(gitdir: string) {
    const packedRefsFilename = pathJoin(gitdir, 'packed-refs');
    const packedRefs = new Map<string, string>();

    if (existsSync(packedRefsFilename)) {
        const packedRefsContent = await fsPromises.readFile(packedRefsFilename, 'utf8');
        let ref = null;

        for (const line of packedRefsContent.trim().split(/\r\n?|\n/)) {
            if (line.startsWith('#')) {
                continue;
            }

            if (line.startsWith('^')) {
                // This is a oid for the commit associated with the annotated tag immediately preceding this line.
                // Trim off the '^'
                const oid = line.slice(1);

                // The tagname^{} syntax is based on the output of `git show-ref --tags -d`
                packedRefs.set(ref + '^{}', oid);
            } else {
                // This is an oid followed by the ref name
                const spaceOffset = line.indexOf(' ');
                const oid = line.slice(0, spaceOffset);

                ref = line.slice(spaceOffset + 1);
                packedRefs.set(ref, oid);
            }
        }
    }

    return packedRefs;
}
