import { promises as fsPromises, existsSync } from 'fs';
import { join as pathJoin } from 'path';
import { scanFs } from '@discoveryjs/scan-fs';

type Ref = { name: string; oid: string };

// https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions
const refpaths = (ref: string) => [
    ref,
    pathJoin('refs', ref),
    pathJoin('refs', 'tags', ref),
    pathJoin('refs', 'heads', ref),
    pathJoin('refs', 'remotes', ref),
    pathJoin('refs', 'remotes', ref, 'HEAD')
];

function isOid(value: unknown) {
    return typeof value === 'string' && value.length === 40 && /[0-9a-f]{40}/.test(value);
}

export async function createRefIndex(gitdir: string) {
    const packedRefs = await readPackedRefs(gitdir);
    // expand a ref into a full form
    const expandRef = async (ref: string) => {
        // Look in all the proper paths, in this order
        for (const candidateRef of refpaths(ref)) {
            if (packedRefs.has(candidateRef)) {
                return candidateRef;
            }

            try {
                const stat = await fsPromises.stat(pathJoin(gitdir, candidateRef));

                if (stat.isFile()) {
                    return candidateRef;
                }
            } catch {}
        }

        // Do we give up?
        return null;
    };
    const resolveRef = async (ref: string) => {
        // Is it a complete and valid SHA?

        while (!isOid(ref)) {
            // Is it a ref pointer?
            if (ref.startsWith('ref: ')) {
                ref = ref.slice(5); // 'ref: '.length == 5
                continue;
            }
            // For files where appears additional information, such as tags, branch names and comments
            if (/\s/.test(ref)) {
                ref = ref.split(/\s+/)[0];
                continue;
            }

            const expandedRef = await expandRef(ref);

            if (expandedRef === null) {
                throw new Error(`Reference "${ref}" not found`);
            }

            ref =
                packedRefs.get(expandedRef) ||
                (await fsPromises.readFile(pathJoin(gitdir, expandedRef), 'utf8')).trimEnd();
        }

        return ref;
    };

    const listRemotes = async () => {
        const remotes = [];
        const entries = await fsPromises.readdir(pathJoin(gitdir, 'refs', 'remotes'), {
            withFileTypes: true
        });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                remotes.push(entry.name);
            }
        }

        return remotes;
    };

    // List all the refs that match the prefix
    const listRefsCache = new Map<string, Ref[]>();
    const listRefs = async (gitdir: string, prefix: string, withOid: boolean) => {
        let refs = listRefsCache.get(prefix);

        if (refs === undefined) {
            const packedRefs = await readPackedRefs(gitdir);
            const refsMap = new Map<string, string>();

            await scanFs({
                basedir: pathJoin(gitdir, prefix),
                rules: {
                    async extract(file, content) {
                        const oid = await resolveRef(content.trimEnd());

                        if (oid) {
                            refsMap.set(file.path, oid);
                        }
                    }
                }
            });

            // add refs filtered by a prefix as prefix
            for (const [ref, oid] of packedRefs.entries()) {
                if (ref.startsWith(prefix) && !ref.endsWith('^{}')) {
                    refsMap.set(ref.slice(prefix.length), oid);
                }
            }

            refs = [...refsMap.entries()]
                .map(([name, oid]) => ({ name, oid }))
                .sort(compareRefNames);

            listRefsCache.set(prefix, refs);
        }

        if (withOid) {
            return refs.map((ref) => ({ ...ref }));
        }

        return refs.map((ref) => ref.name);
    };

    const listBranches = (remote?: string | null, withOids = false) => {
        if (remote) {
            return listRefs(gitdir, `refs/remotes/${remote}/`, withOids);
        } else {
            return listRefs(gitdir, 'refs/heads/', withOids);
        }
    };

    const listTags = (withOids = false) => {
        return listRefs(gitdir, 'refs/tags/', withOids);
    };

    return {
        resolveRef,
        expandRef(ref: string) {
            return isOid(ref) ? ref : expandRef(ref);
        },
        async isRefExists(ref: string) {
            return (await expandRef(ref)) !== null;
        },

        listRemotes,
        listBranches,
        listTags,

        async stat() {
            const remotes = [null, ...(await listRemotes())];

            return {
                remotes: (await Promise.all(remotes.map((remote) => listBranches(remote)))).map(
                    (branches, idx) => ({
                        remote: remotes[idx],
                        branches
                    })
                ),
                branches: await listBranches(),
                tags: await listTags()
            };
        }
    };
}

// https://stackoverflow.com/a/40355107/2168416
function compareRefNames(a: Ref, b: Ref) {
    const _a = a.name.replace(/\^\{\}$/, '');
    const _b = b.name.replace(/\^\{\}$/, '');
    const cmp = -(_a < _b) || Number(_a > _b);

    if (cmp === 0) {
        return a.name.endsWith('^{}') ? 1 : -1;
    }

    return cmp;
}

async function readPackedRefs(gitdir: string) {
    const packedRefsFilename = pathJoin(gitdir, 'packed-refs');
    const packedRefs = new Map<string, string>();

    if (existsSync(packedRefsFilename)) {
        const packedRefsContent = await fsPromises.readFile(packedRefsFilename, 'utf8');
        let ref = null;

        for (const line of packedRefsContent.trim().split('\n')) {
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
