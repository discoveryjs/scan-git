import { ReadObjectByHash, ReadObjectByOid, ResolveRef, Tree, TreeEntry } from './types';
import { EMPTY_TREE_OID } from './const.js';
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
                    await collectFilesDelta(
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
        if (typeof ref !== 'string') {
            return EMPTY_TREE_OID;
        }

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

        async deltaFiles(nextRef = 'HEAD', prevRef?: string) {
            if (!prevRef) {
                const prevOid = await resolveRef(nextRef);
                const prev = await readObjectByOid(prevOid);

                prevRef =
                    prev.type === 'commit' ? parseCommit(prev.object).parent[0] : EMPTY_TREE_OID;
            }

            const prevTreeOid = await treeOidFromRef(prevRef);
            const nextTreeOid = await treeOidFromRef(nextRef);
            const delta: FileDelta = {
                add: [],
                modify: [],
                remove: []
            };

            if (prevTreeOid !== nextTreeOid) {
                await collectFilesDelta(
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
