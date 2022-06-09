import type { createLooseObjectIndex } from './loose-object-index.js';
import type { createPackedObjectIndex } from './packed-object-index.js';

export type GetExternalRefDelta = (oid: string) => Promise<Record<string, any> | null>;
export type ReadResult =
    | InternalGitObjectDeflated
    | InternalGitObjectWrapped
    | InternalGitObjectContent;
export type ReadObjectByOid<T extends ReadResult['format'] = 'content'> = (
    oid: string,
    format?: T
) => Promise<Extract<ReadResult, { format: T }>>;
export type ReadObjectByHash<T extends ReadResult['format'] = 'content'> = (
    hash: Buffer,
    format?: T
) => Promise<Extract<ReadResult, { format: T }>>;

export type ResolveRef = (ref: string) => Promise<string>;

export type LooseObjectIndex = Awaited<ReturnType<typeof createLooseObjectIndex>>;
export type PackedObjectIndex = Awaited<ReturnType<typeof createPackedObjectIndex>>;

export type CommitObject = { type: 'commit' };
export type TagObject = { type: 'tag' };
export type TreeObject = { type: 'tree' };
export type BlobObject = { type: 'blob' };
export type GitObject = CommitObject | TagObject | TreeObject | BlobObject;

export type InternalGitObjectFormat = InternalGitObject['format'];
export type InternalGitObject =
    | InternalGitObjectDeflated
    | InternalGitObjectWrapped
    | InternalGitObjectContent
    | InternalGitObjectParsed;
export type InternalGitObjectDeflated = {
    format: 'deflated';
    object: Buffer;
};
export type InternalGitObjectWrapped = {
    format: 'wrapped';
    object: Buffer;
};
export type InternalGitObjectContent = {
    type: GitObject['type'];
    format: 'content';
    object: Buffer;
};
export type InternalGitObjectParsed = {
    format: 'parsed';
    object: Buffer;
};

export type Author = {
    name: string;
    email: string;
    timestamp: number; // UTC Unix timestamp in seconds
    timezoneOffset: number; // Timezone difference from UTC in minutes
};

export type AnnotatedTag = {
    tag: string; // the tag name
    type: 'blob' | 'tree' | 'commit' | 'tag'; // the type of the object being tagged
    object: string; // SHA-1 object id of object being tagged
    tagger: Author;
    message: string;
    gpgsig?: string; // PGP signature (if present)
};

export type Commit = {
    tree: string; // SHA-1 object id of corresponding file tree
    parent: string[]; // an array of zero or more SHA-1 object ids
    author: Author;
    committer: Author;
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
    hash: Buffer | null;
};
export type TreeEntry = TreeEntryTree | TreeEntryBlob;
export type Tree = TreeEntry[];
