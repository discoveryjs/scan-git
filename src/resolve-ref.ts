import { promises as fsPromises, existsSync } from 'fs';
import { join as pathJoin } from 'path';
import { scanFs } from '@discoveryjs/scan-fs';

// @see https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions
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
        // Is it a complete and valid SHA?
        if (isOid(ref)) {
            return ref;
        }

        // Look in all the proper paths, in this order
        const allpaths = refpaths(ref);

        for (const ref of allpaths) {
            if (packedRefs.has(ref)) {
                return ref;
            }

            try {
                await fsPromises.stat(pathJoin(gitdir, ref));
                return ref;
            } catch {}
        }

        // Do we give up?
        throw new Error(`Ref "${ref}" not found`);
    };
    const resolveRef = async (ref: string): Promise<string> => {
        // Is it a ref pointer?
        if (ref.startsWith('ref: ')) {
            ref = ref.slice(5); // 'ref: '.length == 5
        }

        // Is it a complete and valid SHA?
        if (isOid(ref)) {
            return ref;
        }

        const expandedRef = await expandRef(ref);
        ref = (await fsPromises.readFile(pathJoin(gitdir, expandedRef), 'utf8')).trimEnd();

        return resolveRef(ref);
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

    const listBranches = (remote?: string | null) => {
        if (remote) {
            return listRefs(gitdir, `refs/remotes/${remote}/`);
        } else {
            return listRefs(gitdir, 'refs/heads/');
        }
    };

    const listTags = () => {
        return listRefs(gitdir, 'refs/tags/');
    };

    return {
        expandRef,
        resolveRef,
        async isRefExists(ref: string) {
            try {
                await expandRef(ref);
                return true;
            } catch (err) {
                return false;
            }
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
function compareRefNames(a: string, b: string) {
    const _a = a.replace(/\^\{\}$/, '');
    const _b = b.replace(/\^\{\}$/, '');
    const cmp = -(_a < _b) || Number(_a > _b);

    if (cmp === 0) {
        return a.endsWith('^{}') ? 1 : -1;
    }

    return cmp;
}

// List all the refs that match the `filepath` prefix
async function listRefs(gitdir: string, prefix: string) {
    const packedRefs = await readPackedRefs(gitdir);
    const files = new Set<string>();

    try {
        for (const file of await scanFs({ basedir: pathJoin(gitdir, prefix) })) {
            files.add(file.path);
        }
    } catch (e) {}

    // add refs filtered by a prefix as prefix
    for (const ref of packedRefs.keys()) {
        if (ref.startsWith(prefix) && !ref.endsWith('^{}')) {
            files.add(ref.slice(prefix.length));
        }
    }

    // since we just appended things onto an array, we need to sort them now
    return [...files].sort(compareRefNames);
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
