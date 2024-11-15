import type { createLooseObjectIndex } from './loose-object-index.js';
import type { createPackedObjectIndex } from './packed-object-index.js';

export type InternalReadObject = (hash: Buffer) => Promise<InternalGitObjectContent | null>;
export type InternalReadObjectHeader = (hash: Buffer) => Promise<InternalGitObjectHeader | null>;
export type ReadObjectByOid = (oid: string) => Promise<InternalGitObjectContent>;
export type ReadObjectByHash = (hash: Buffer) => Promise<InternalGitObjectContent>;

export type ResolveRef = (ref: string) => Promise<string>;

export type LooseObjectIndex = Awaited<ReturnType<typeof createLooseObjectIndex>>;
export type PackedObjectIndex = Awaited<ReturnType<typeof createPackedObjectIndex>>;

export type PackedObjectType =
    | 'invalid'
    | 'commit'
    | 'tree'
    | 'blob'
    | 'reserved'
    | 'tag'
    | 'ofs_delta'
    | 'ref_delta';

export type CommitObject = { type: 'commit' };
export type TagObject = { type: 'tag' };
export type TreeObject = { type: 'tree' };
export type BlobObject = { type: 'blob' };
export type GitObject = CommitObject | TagObject | TreeObject | BlobObject;

export type InternalGitObjectHeader = {
    type: GitObject['type'];
    length: number;
};
export type InternalGitObjectContent = {
    type: GitObject['type'];
    object: Buffer;
};

export type Contributor = {
    name: string;
    email: string;
    timestamp: number; // UTC Unix timestamp in seconds
    timezone: string; // Timezone difference from UTC in minutes
};

export type AnnotatedTag = {
    tag: string; // the tag name
    type: 'blob' | 'tree' | 'commit' | 'tag'; // the type of the object being tagged
    object: string; // object id of object being tagged
    tagger: Contributor;
    message: string;
    gpgsig?: string; // PGP signature (if present)
};

export type LogCommit = { oid: string } & Commit;
export type Commit = {
    tree: string; // object id of corresponding file tree
    parent: string[]; // an array of zero or more object ids
    author: Contributor;
    committer: Contributor;
    message: string;
    gpgsig?: string; // PGP signature (if present)
};

export type TreeEntryTree = {
    isTree: true;
    path: string;
    hash: Buffer;
};
export type TreeEntryBlob = {
    isTree: false;
    path: string;
    hash: Buffer;
};
export type TreeEntry = TreeEntryTree | TreeEntryBlob;
export type Tree = TreeEntry[];

export type ObjectsStat = {
    count: number;
    size: number;
    unpackedSize: number;
    unpackedRestoredSize: number;
};
export type ObjectsStatWithTypes = ObjectsStat & {
    types: ObjectsTypeStat[];
};
export type ObjectsTypeStat = {
    type: PackedObjectType;
} & ObjectsStat;

type Added = 1;
type Removed = 2;
type Modified = 3;
type TreeDiffAdded = {
    type: Added;
    isTree: boolean;
    path: string;
    hash: Buffer;
};
type TreeDiffRemoved = {
    type: Removed;
    isTree: boolean;
    path: string;
    hash: Buffer;
};
type TreeDiffModified = {
    type: Modified;
    isTree: boolean;
    path: string;
    hash: Buffer;
    prevHash: Buffer;
};
export type TreeDiffEntry = TreeDiffAdded | TreeDiffRemoved | TreeDiffModified;
export type TreeDiff = TreeDiffEntry[];

export type CruftPackMode =
    /** Processes all packs */
    | 'include'
    /** Excludes cruft packs from processing */
    | 'exclude'
    /** Processes cruft packs only */
    | 'only';

export interface GitReaderOptions {
    /**
     * Controls the inclusion of cruft packs in packed objects procession.
     * @see {@link https://git-scm.com/docs/cruft-packs} for more info about cruft packs.
     *
     * true - alias for 'include'
     * false - alias for 'exclude'
     *
     * @default 'include'
     */
    cruftPacks: CruftPackMode | boolean;

    /**
     * Maximum number of concurrent file system operations.
     * @default 50
     */
    maxConcurrency: number;
}

export interface NormalizedGitReaderOptions {
    cruftPacks: CruftPackMode;
    maxConcurrency: number;
    performConcurrent: <T, R>(
        queue: T[],
        action: (item: T, itemIdx: number) => Promise<R>
    ) => Promise<R[]>;
}
