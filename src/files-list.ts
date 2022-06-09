import { ReadObjectByHash, ReadObjectByOid, ResolveRef, TreeEntry } from './types';
import { parseAnnotatedTag, parseCommit, parseTree } from './parse-object.js';

type FileEntry = { path: string; hash: Buffer };
type FileListEntry = string | FileEntry;
type DeltaEntry = {
    op: 'add' | 'modify' | 'remove';
    path: string;
    hash?: string;
    prevHash?: string;
};

async function accumulateFilesFromOid({
    hash,
    readObjectByHash,
    filenames,
    prefix,
    filesWithHash = false
}: {
    readObjectByHash: ReadObjectByHash;
    hash: Buffer;
    prefix: string;
    filenames: Array<any>;
    filesWithHash?: boolean;
}): Promise<void> {
    const { object } = await readObjectByHash(hash);
    const tree = parseTree(object, filesWithHash);
    const tasks = [];

    for (const entry of tree) {
        if (entry.isTree) {
            tasks.push(
                accumulateFilesFromOid({
                    readObjectByHash,
                    hash: entry.hash,
                    prefix: `${prefix}${entry.path}/`,
                    filenames,
                    filesWithHash
                })
            );
        } else {
            const path = `${prefix}${entry.path}`;
            filenames.push(filesWithHash ? { path, hash: entry.hash } : path);
        }
    }

    return Promise.all(tasks).then();
}

async function findFilesDelta({
    hash1,
    hash2,
    readObjectByHash,
    delta,
    prefix
}: {
    hash1: Buffer;
    hash2: Buffer;
    readObjectByHash: ReadObjectByHash;
    delta: Array<DeltaEntry>;
    prefix: string;
}) {
    const { object: treeObject1 } = await readObjectByHash(hash1);
    const tree1 = parseTree(treeObject1, true);
    const { object: treeObject2 } = await readObjectByHash(hash2);
    const tree2 = parseTree(treeObject2, true);
    const tree1map = new Map<string, TreeEntry>();

    for (const entry1 of tree1) {
        tree1map.set(entry1.path, entry1);
    }

    for (const entry2 of tree2) {
        const entry1 = tree1map.get(entry2.path);

        if (entry1 === undefined) {
            delta.push({
                op: 'remove',
                path: `${prefix}${entry2.path}`,
                hash: entry2.hash?.toString('hex')
            });
        } else {
            tree1map.delete(entry2.path);

            // compare
            if (entry1.isTree !== entry2.isTree) {
                // todo
                console.log('Not implemeneted');
            } else if (!entry1.hash?.equals(entry2.hash as Buffer)) {
                if (entry1.isTree && entry2.isTree) {
                    await findFilesDelta({
                        hash1: entry1.hash,
                        hash2: entry2.hash,
                        readObjectByHash,
                        prefix: `${prefix}${entry2.path}/`,
                        delta
                    });
                } else {
                    delta.push({
                        op: 'modify',
                        path: `${prefix}${entry2.path}`,
                        hash: entry2.hash?.toString('hex'),
                        prevHash: entry1.hash?.toString('hex')
                    });
                }
            }
        }
    }

    for (const entry1 of tree1map.values()) {
        if (entry1.isTree) {
            // all removed
            const removed: FileEntry[] = [];
            await accumulateFilesFromOid({
                readObjectByHash,
                hash: entry1.hash,
                filenames: removed,
                prefix: `${prefix}${entry1.path}/`,
                filesWithHash: true
            }).then(() => {
                for (const entry of removed) {
                    delta.push({
                        op: 'remove',
                        path: `${prefix}${entry.path}`,
                        hash: entry.hash.toString('hex')
                    });
                }
            });
        } else {
            delta.push({
                op: 'add',
                path: `${prefix}${entry1.path}`,
                hash: entry1.hash?.toString('hex')
            });
        }
    }
}

async function resolveRefToTree(oid: string, readObject: ReadObjectByOid): Promise<string> {
    const { type, object } = await readObject(oid);

    // Resolve annotated tag objects to whatever
    if (type === 'tag') {
        return resolveRefToTree(parseAnnotatedTag(object).object, readObject);
    }

    // Resolve commits to trees
    if (type === 'commit') {
        return parseCommit(object).tree;
    }

    if (type !== 'tree') {
        throw new Error(`Object ${oid} must be a "tree" but "${type}"`);
    }

    return oid;
}

export function createFilesMethods(
    readObjectByOid: ReadObjectByOid,
    readObjectByHash: ReadObjectByHash,
    resolveRef: ResolveRef
) {
    async function treeOidFromRef(ref: string) {
        const oid = await resolveRef(ref);
        const treeOid = await resolveRefToTree(oid, readObjectByOid);

        return treeOid;
    }

    return {
        treeOidFromRef,

        async listFiles(ref = 'HEAD') {
            const treeOid = await treeOidFromRef(ref);
            const filenames: FileListEntry[] = [];

            await accumulateFilesFromOid({
                hash: Buffer.from(treeOid, 'hex'),
                readObjectByHash,
                filenames,
                prefix: ''
            });

            return filenames;
        },

        async deltaFiles(
            ref1 = 'HEAD',
            ref2: string
            // ref1 = "d81c26f1e40cff1e061ad5d4a53ddaabdac2d039",
            // ref2 = "d02877e9d4a2ae5461de8dd45b0f7be0ce3d72dd"
        ) {
            if (!ref2) {
                const oid = await resolveRef(ref1);
                const commit = await readObjectByOid(oid);

                ref2 = parseCommit(commit.object).parent[0];
            }

            const treeOid1 = await treeOidFromRef(ref1);
            const treeOid2 = await treeOidFromRef(ref2);
            // console.log(ref1, ref2);
            // console.log(treeOid);
            const delta: DeltaEntry[] = [];

            if (treeOid1 !== treeOid2) {
                await findFilesDelta({
                    hash1: Buffer.from(treeOid1, 'hex'),
                    hash2: Buffer.from(treeOid2, 'hex'),
                    readObjectByHash,
                    delta,
                    prefix: ''
                });
            }

            return delta;
        }
    };
}
