import { Commit, ReadObjectByOid, ResolveRef } from './types';
import { parseAnnotatedTag, parseCommit } from './parse-object.js';

async function resolveRefToCommit(oid: string, readObject: ReadObjectByOid): Promise<string> {
    const { type, object } = await readObject(oid);

    // Resolve annotated tag objects to whatever
    if (type === 'tag') {
        return resolveRefToCommit(parseAnnotatedTag(object).object, readObject);
    }

    if (type !== 'commit') {
        throw new Error(`Object ${oid} must be a "commit" but "${type}"`);
    }

    return oid;
}

function findMaxAgedCommit(commits: ReadCommit[]) {
    let result = commits[0];
    let maxDate = result.committer.timestamp;

    for (const commit of commits) {
        if (commit.committer.timestamp > maxDate) {
            maxDate = commit.committer.timestamp;
            result = commit;
        }
    }

    return result;
}

type ReadCommit = { oid: string } & Commit;

export function createCommitMethods(readObjectByOid: ReadObjectByOid, resolveRef: ResolveRef) {
    async function commitOidFromRef(ref: string) {
        const oid = await resolveRef(ref);
        const commitOid = await resolveRefToCommit(oid, readObjectByOid);

        return commitOid;
    }

    async function readCommit(oid: string): Promise<ReadCommit> {
        const { object } = await readObjectByOid(oid);

        return { oid, ...parseCommit(object) };
    }

    return {
        commitOidFromRef,

        async log({ ref = 'HEAD', depth = 20 }: { ref?: string; depth?: number } = {}) {
            const commitOid = await commitOidFromRef(ref);
            const commits: ReadCommit[] = [];
            const candidates = new Set<ReadCommit>([await readCommit(commitOid)]);
            const seen = new Set<string>();

            while (commits.length < depth && candidates.size > 0) {
                const next = findMaxAgedCommit([...candidates]);

                for (const oid of next.parent) {
                    if (!seen.has(oid)) {
                        candidates.add(await readCommit(oid));
                        seen.add(oid);
                    }
                }

                commits.push(next);
                candidates.delete(next);
            }

            return commits;
        }
    };
}
