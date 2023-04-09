import { ReadObjectByHash, ReadObjectByOid, ResolveRef, Tree, TreeEntry } from './types';
import { EMPTY_TREE_OID } from './const.js';
import { parseAnnotatedTag, parseCommit, parseTree } from './parse-object.js';
import {
    ADDED,
    REMOVED,
    MODIFIED,
    diffTrees,
    findTreeEntry,
    findTreeEntries
} from './tree-utils.js';

type ReadTree = (hash: Buffer) => Promise<Tree>;
type FileEntry = { path: string; hash: string };
type FileListEntry = string | FileEntry;
type FileDeltaEntry = { path: string; hash: string };
type FileDelta = {
    add: FileDeltaEntry[];
    modify: (FileDeltaEntry & { prevHash: string })[];
    remove: FileDeltaEntry[];
};
type Path = { path: string; segments: string[] };
type FilenameEntry<T extends boolean> = T extends true ? FileEntry : string;

async function collectTreeFiles(
    hash: Buffer,
    readTree: ReadTree,
    prefix: string,
    filenames: FileListEntry[],
    filesWithHash = false
): Promise<any> {
    const tree = await readTree(hash);
    const taskCount = 10;
    const tasks: (Promise<any> | null)[] = Array.from({ length: taskCount }, () => null);
    let taskNum = 0;

    for (const entry of tree) {
        if (entry.isTree) {
            if (taskNum++ % taskCount === 0) {
                await Promise.all(tasks);
            }

            tasks[taskNum] = collectTreeFiles(
                entry.hash,
                readTree,
                `${prefix}${entry.path}/`,
                filenames,
                filesWithHash
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
    readObjectByHash: ReadObjectByHash,
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

async function collectTreeEntries(
    result: TreeEntry[],
    pathsInfo: Path[],
    readObjectByHash: ReadObjectByHash,
    treeHash: Buffer,
    level: number
): Promise<void> {
    // Group segments with the same first segment
    const groups = new Map<string, Path[]>();
    for (const pathInfo of pathsInfo) {
        const key = pathInfo.segments[level];
        const group = groups.get(key);

        if (group === undefined) {
            groups.set(key, [pathInfo]);
        } else {
            group.push(pathInfo);
        }
    }

    // Find tree entries for the groups
    const { object: treeObject } = await readObjectByHash(treeHash);
    const groupPaths = Array.from(groups.keys());
    const foundEntries = findTreeEntries(treeObject, groupPaths);

    for (const entry of foundEntries) {
        const group = groups.get(entry.path) as Path[];
        const subtreePaths: Path[] = [];

        for (const pathInfo of group) {
            if (pathInfo.segments.length === level + 1) {
                entry.path = pathInfo.path;
                result.push(entry);
            } else if (entry.isTree) {
                subtreePaths.push(pathInfo);
            }
        }

        if (subtreePaths.length > 0) {
            await collectTreeEntries(result, subtreePaths, readObjectByHash, entry.hash, level + 1);
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
    async function getPathEntry(path: string, ref = 'HEAD'): Promise<TreeEntry | null> {
        const treeOid = await treeOidFromRef(ref);
        const pathSegments = path.split('/');
        let treeHash = Buffer.from(treeOid, 'hex');

        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            const { object: treeObject } = await readObjectByHash(treeHash);
            const entry = findTreeEntry(treeObject, segment);

            if (entry === null) {
                break;
            }

            if (i === pathSegments.length - 1) {
                entry.path = path;
                return entry;
            }

            if (!entry.isTree) {
                break;
            }

            treeHash = entry.hash;
        }

        return null;
    }

    async function getPathsEntries(paths: string[], ref = 'HEAD'): Promise<TreeEntry[]> {
        const treeOid = await treeOidFromRef(ref);
        const entries: TreeEntry[] = [];
        const treeHash = Buffer.from(treeOid, 'hex');

        // Sort paths and split them into segments
        const sortedPaths = [...paths].sort();
        const pathSegments = sortedPaths.map((path) => ({
            path,
            segments: path.split('/')
        }));

        await collectTreeEntries(entries, pathSegments, readObjectByHash, treeHash, 0);

        return entries;
    }

    return {
        treeOidFromRef,
        getPathEntry,
        getPathsEntries,

        async listFiles<T extends boolean = false>(ref = 'HEAD', filesWithHash?: T) {
            const treeOid = await treeOidFromRef(ref);
            const filenames: FilenameEntry<T>[] = [];

            await collectTreeFiles(
                Buffer.from(treeOid, 'hex'),
                readTree,
                '',
                filenames,
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
