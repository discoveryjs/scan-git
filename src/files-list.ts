import { ReadObjectByHash, ReadObjectByOid, ResolveRef, Tree, TreeEntry } from './types';
import {
    ADDED,
    REMOVED,
    MODIFIED,
    diffTrees,
    parseAnnotatedTag,
    parseCommit,
    parseTree
} from './parse-object.js';

type ReadTree = (hash: Buffer) => Promise<Tree>;
type FileEntry = { path: string; hash: string };
type FileListEntry = string | FileEntry;
type FileDeltaEntry = { path: string; hash: string };
type FileDelta = {
    add: FileDeltaEntry[];
    modify: (FileDeltaEntry & { prevHash: string })[];
    remove: FileDeltaEntry[];
};

async function collectTreeFiles(
    hash: Buffer,
    readTree: ReadTree,
    prefix: string,
    filenames: FileListEntry[],
    filesWithHash = false
): Promise<any> {
    const tree = await readTree(hash);
    const tasks = [];

    for (const entry of tree) {
        if (entry.isTree) {
            tasks.push(
                collectTreeFiles(
                    entry.hash,
                    readTree,
                    `${prefix}${entry.path}/`,
                    filenames,
                    filesWithHash
                )
            );
        } else {
            const path = `${prefix}${entry.path}`;

            if (filesWithHash) {
                filenames.push({ path, hash: entry.hash.toString('hex') });
            } else {
                filenames.push(path);
            }
        }
    }

    return Promise.all(tasks);
}

function addEntryToDelta(target: FileDeltaEntry[], pathPrefix: string, entry: TreeEntry) {
    target.push({
        path: `${pathPrefix}${entry.path}`,
        hash: entry.hash.toString('hex')
    });
}

function addSubtreeToDelta(
    target: FileDeltaEntry[],
    pathPrefix: string,
    entry: TreeEntry,
    readTree: ReadTree
) {
    return collectTreeFiles(entry.hash, readTree, `${pathPrefix}${entry.path}/`, target, true);
}

async function collectFilesDelta(
    nextHash: Buffer,
    prevHash: Buffer,
    readTree: ReadTree,
    prefix: string,
    delta: FileDelta
) {
    const [nextTree, prevTree] = await Promise.all([readTree(nextHash), readTree(prevHash)]);
    const nextTreeMap = new Map<string, TreeEntry>();

    for (const nextEntry of nextTree) {
        nextTreeMap.set(nextEntry.path, nextEntry);
    }

    for (const prevEntry of prevTree) {
        const nextEntry = nextTreeMap.get(prevEntry.path);

        if (nextEntry === undefined) {
            if (prevEntry.isTree) {
                await addSubtreeToDelta(delta.remove, prefix, prevEntry, readTree);
            } else {
                addEntryToDelta(delta.remove, prefix, prevEntry);
            }
        } else {
            nextTreeMap.delete(prevEntry.path);

            // compare
            if (nextEntry.isTree !== prevEntry.isTree) {
                if (nextEntry.isTree) {
                    addEntryToDelta(delta.remove, prefix, prevEntry);
                    await addSubtreeToDelta(delta.add, prefix, nextEntry, readTree);
                } else if (prevEntry.isTree) {
                    addEntryToDelta(delta.add, prefix, nextEntry);
                    await addSubtreeToDelta(delta.remove, prefix, prevEntry, readTree);
                }
            } else if (!nextEntry.hash?.equals(prevEntry.hash as Buffer)) {
                if (nextEntry.isTree && prevEntry.isTree) {
                    await collectFilesDelta(
                        nextEntry.hash,
                        prevEntry.hash,
                        readTree,
                        `${prefix}${prevEntry.path}/`,
                        delta
                    );
                } else {
                    delta.modify.push({
                        path: `${prefix}${nextEntry.path}`,
                        hash: nextEntry.hash.toString('hex'),
                        prevHash: prevEntry.hash.toString('hex')
                    });
                }
            }
        }
    }

    for (const nextEntry of nextTreeMap.values()) {
        if (nextEntry.isTree) {
            await addSubtreeToDelta(delta.add, prefix, nextEntry, readTree);
        } else {
            addEntryToDelta(delta.add, prefix, nextEntry);
        }
    }
}

async function collectFilesDelta2(
    prevHash: Buffer,
    nextHash: Buffer,
    readObjectByHash: any,
    readTree: ReadTree,
    prefix: string,
    delta: FileDelta
) {
    const [{ object: prevTree }, { object: nextTree }] = await Promise.all([
        readObjectByHash(prevHash),
        readObjectByHash(nextHash)
    ]);

    for (const entry of diffTrees(prevTree, nextTree)) {
        switch (entry.type) {
            case ADDED:
                if (entry.isTree) {
                    await addSubtreeToDelta(delta.add, prefix, entry, readTree);
                } else {
                    delta.add.push({
                        path: `${prefix}${entry.path}`,
                        hash: entry.hash.toString('hex')
                    });
                }
                break;

            case REMOVED:
                if (entry.isTree) {
                    await addSubtreeToDelta(delta.remove, prefix, entry, readTree);
                } else {
                    delta.remove.push({
                        path: `${prefix}${entry.path}`,
                        hash: entry.hash.toString('hex')
                    });
                }
                break;

            case MODIFIED:
                if (entry.isTree) {
                    await collectFilesDelta2(
                        entry.prevHash,
                        entry.hash,
                        readObjectByHash,
                        readTree,
                        `${prefix}${entry.path}/`,
                        delta
                    );
                } else {
                    delta.modify.push({
                        path: `${prefix}${entry.path}`,
                        hash: entry.hash.toString('hex'),
                        prevHash: entry.prevHash.toString('hex')
                    });
                }
                break;
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
    async function readTree(hash: Buffer) {
        const { object: treeObject } = await readObjectByHash(hash);
        const tree = parseTree(treeObject);

        return tree;
    }

    return {
        treeOidFromRef,

        async listFiles<T extends boolean = false, R = T extends true ? FileEntry : string>(
            ref = 'HEAD',
            filesWithHash: T
        ) {
            const treeOid = await treeOidFromRef(ref);
            const filenames: R[] = [];

            await collectTreeFiles(
                Buffer.from(treeOid, 'hex'),
                readTree,
                '',
                filenames as any, // FIXME
                filesWithHash
            );

            return filenames;
        },

        async deltaFiles(nextRef = 'HEAD', prevRef: string) {
            if (!prevRef) {
                const prevOid = await resolveRef(nextRef);
                const prevCommit = await readObjectByOid(prevOid);

                prevRef = parseCommit(prevCommit.object).parent[0];
            }

            const treeOid1 = await treeOidFromRef(nextRef);
            const treeOid2 = await treeOidFromRef(prevRef);
            const delta: FileDelta = {
                add: [],
                modify: [],
                remove: []
            };

            if (treeOid1 !== treeOid2) {
                await collectFilesDelta(
                    Buffer.from(treeOid1, 'hex'),
                    Buffer.from(treeOid2, 'hex'),
                    readTree,
                    '',
                    delta
                );
            }

            return delta;
        },

        async deltaFiles2(nextRef = 'HEAD', prevRef: string) {
            if (!prevRef) {
                const prevOid = await resolveRef(nextRef);
                const prevCommit = await readObjectByOid(prevOid);

                prevRef = parseCommit(prevCommit.object).parent[0];
            }

            const prevTreeOid = await treeOidFromRef(prevRef);
            const nextTreeOid = await treeOidFromRef(nextRef);
            const delta: FileDelta = {
                add: [],
                modify: [],
                remove: []
            };

            if (prevTreeOid !== nextTreeOid) {
                await collectFilesDelta2(
                    Buffer.from(prevTreeOid, 'hex'),
                    Buffer.from(nextTreeOid, 'hex'),
                    readObjectByHash,
                    readTree,
                    '',
                    delta
                );
            }

            return delta;
        }
    };
}
