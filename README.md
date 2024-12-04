# @discoveryjs/scan-git

[![NPM version](https://img.shields.io/npm/v/@discoveryjs/scan-git.svg)](https://www.npmjs.com/package/@discoveryjs/scan-git)
[![Build](https://github.com/discoveryjs/scan-git/actions/workflows/build.yml/badge.svg)](https://github.com/discoveryjs/scan-git/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/discoveryjs/scan-git/badge.svg?branch=main)](https://coveralls.io/github/discoveryjs/scan-git?branch=main)

`@discoveryjs/scan-git` is a powerful Node.js library designed for reading and analyzing Git repositories directly from the filesystem. It provides a rich set of APIs that allow you to access Git objects, references, commits, trees, and more without the need for Git command-line tools or external dependencies.

Whether you're building tools for repository analysis, visualization, or automation, `@discoveryjs/scan-git` provides a robust and efficient API to meet your Git interaction needs.

**Key Features:**

- **Direct Repository Access:** Interact with Git repositories by reading data directly from the `.git` directory.
- **Comprehensive Git Object Support:** Work with both loose and packed objects, including support for large pack files over 2GB.
- **Advanced Git Features:** Handle complex repository structures with support for cruft packs and on-disk reverse indexes.
- **Efficient Data Retrieval:** Efficiently fetch commit histories, branches, tags, and files, even for large repositories.
- **Flexible APIs:** Compute diffs between commits, read specific Git objects, and parse commits, trees, and annotated tags.

## Usage

```
npm install @discoveryjs/scan-git
```

## API

- Git reader
  - [`createGitReader(gitdir, options?)`](#creategitreadergitdir-options)
  - [`reader.dispose()`](#readerdispose)
  - Reference methods
    - [`reader.defaultBranch()`](#readerdefaultbranch)
    - [`reader.currentBranch()`](#readercurrentbranch)
    - [`reader.isRefExists(ref)`](#readerisrefexistsref)
    - [`reader.expandRef(ref)`](#readerexpandrefref)
    - [`reader.resolveRef(ref)`](#readerresolverefref)
    - [`reader.describeRef(ref)`](#readerdescriberefref)
    - [`reader.isOid(value)`](#readerisoidvalue)
    - [`reader.listRemotes()`](#readerlistremotes)
    - [`reader.listRemoteBranches(remote, withOid?)`](#readerlistremotebranchesremote-withoid)
    - [`reader.listBranches(withOid?)`](#readerlistbrancheswithoid)
    - [`reader.listTags(withOid?)`](#readerlisttagswithoid)
  - Trees (file lists) methods
    - [`reader.treeOidFromRef(ref)`](#readertreeoidfromrefref)
    - [`reader.listFiles(ref, filesWithHash)`](#readerlistfilesref-fileswithhash)
    - [`reader.getPathEntry(path, ref)`](#readergetpathentrypath-ref)
    - [`reader.getPathsEntries(paths, ref)`](#readergetpathsentriespaths-ref)
    - [`reader.deltaFiles(nextRef, prevRef)`](#readerdeltafilesnextref-prevref)
  - Commit methods
    - [`reader.commitOidFromRef(ref)`](#readercommitoidfromrefref)
    - [`reader.readCommit(ref)`](#readerreadcommitref)
    - [`reader.log(options)`](#readerlogoptions)
  - Misc methods
    - [`reader.readObjectHeaderByHash(hash)`](#readerreadobjectheaderbyhashhash)
    - [`reader.readObjectByHash(hash, cache?)`](#readerreadobjectbyhashhash-cache)
    - [`reader.readObjectHeaderByOid(oid)`](#readerreadobjectheaderbyoidoid)
    - [`reader.readObjectByOid(oid, cache?)`](#readerreadobjectbyoidoid-cache)
    - [`reader.stat()`](#readerstat)
- Utils
  - [`isGitDir(dir)`](#isgitdirdir)
  - [`resolveGitDir(dir)`](#resolvegitdirdir)
  - [`parseContributor(input)`](#parsecontributorinput)
  - [`parseTimezone(offset)`](#parsetimezoneoffset)
  - [`parseAnnotatedTag(object)`](#parseannotatedtagobject)
  - [`parseCommit(object)`](#parsecommitobject)
  - [`parseTree(buffer)`](#parsetreebuffer)

---

### Git reader

```js
import { createGitReader } from '@discoveryjs/scan-git';

const reader = await createGitReader('path/to/.git');
const commits = await reader.log({ ref: 'my-branch', depth: 10 });

console.log(commits);

await reader.dispose();
```

#### `createGitReader(gitdir, options?)`

Creates an instance of the Git reader, which provides access to most of the library's functionality:

- **`gitdir`**: `string`  
  The path to the Git repository. This can either be a directory containing a `.git` folder or a direct path to a `.git` folder (even if it has a non-standard name).
- **`options`** _(optional)_:
  - **`maxConcurrency`**: `number` _(default: 50)_  
    Limits the number of concurrent file system operations
  - **`cruftPacks`**: `'include'` | `'exclude'` | `'only'` | `boolean` _(default: `'include'`)_  
    Defines how [cruft packs](https://git-scm.com/docs/cruft-packs) are processed:
    - `'include'` or `true` – Process all packs
    - `'exclude'` or `false` – Exclude cruft packs from processing
    - `'only'` – Process only cruft packs

```js
import { createGitReader } from '@discoveryjs/scan-git';

const reader = await createGitReader('path/to/.git');
```

#### `reader.dispose()`

Cleans up resources used by the reader instance, such as file handles or caches. This method should be called when the reader instance is no longer needed to ensure proper resource management and avoid memory leaks.

```js
const reader = await createGitReader('path/to/.git');

// do something with reader

// Dispose of the repository instance when done
await reader.dispose();
```

> Note: After calling `dispose()`, attempting to use the reader instance (e.g., calling methods like `log()` or `readCommit()`) will likely result in errors or undefined behavior.

> Note: Always ensure `dispose()` is called in applications or scripts that manage multiple repositories or long-running processes to prevent resource exhaustion.

---

#### Reference methods

Common parameters:

- `ref`: string – a reference to an object in repository
- `withOid`: boolean – a flag to include resolved oid for a reference

##### `reader.defaultBranch()`

Returns the default branch name of a repository:

```js
const defaultBranch = await reader.defaultBranch();
// 'main'
```

The algorithm to identify a default branch name:

- if there is only one branch, that must be the default
- otherwise looking for specific branch names, in this order:
  - `upstream/HEAD`
  - `origin/HEAD`
  - `main`
  - `master`

##### `reader.currentBranch()`

Returns the current branch name along with its commit oid.
If the repository is in a detached HEAD state, `name` will be `null`.

```js
const currentBranch = await reader.currentBranch();
// { name: 'main', oid: '8bb6e23769902199e39ab70f2441841712cbdd62' }

const detachedHead = await reader.currentBranch();
// { name: null, oid: '8bb6e23769902199e39ab70f2441841712cbdd62' }
```

##### `reader.isRefExists(ref)`

Checks if a `ref` exists.

```js
const isValidRef = reader.isRefExists('main');
// true
```

##### `reader.expandRef(ref)`

Expands a `ref` into a full form, e.g. `'main'` -> `'refs/heads/main'`.
Returns `null` if `ref` doesn't exist. For the symbolic ref names (`'HEAD'`, `'FETCH_HEAD'`, `'CHERRY_PICK_HEAD'`, `'MERGE_HEAD'` and `'ORIG_HEAD'`) returns a name without changes.

```js
const fullPath = reader.expandRef('heads/main');
// 'refs/heads/main'
```

##### `reader.resolveRef(ref)`

Resolves `ref` into oid if it exists, otherwise throws an exception.
In case if `ref` is oid, returns this oid back. If ref is not a full path, expands it first.

```js
const oid = await reader.resolveRef('main');
// '8bb6e23769902199e39ab70f2441841712cbdd62'
```

##### `reader.describeRef(ref)`

Returns an info object for provided `ref`.

```js
const info = await reader.describeRef('HEAD');
// {
//   path: 'HEAD',
//   name: 'HEAD',
//   symbolic: true,
//   ref: 'refs/heads/test',
//   oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
// }
```

```js
const info = await reader.describeRef('main');
// {
//   path: 'refs/heads/main',
//   name: 'main',
//   symbolic: false,
//   scope: 'refs/heads',
//   namespace: 'refs',
//   category: 'heads',
//   remote: null,
//   ref: null,
//   oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
// }
```

```js
const info = await reader.describeRef('origin/HEAD');
// {
//   path: 'refs/remotes/origin/HEAD',
//   name: 'HEAD',
//   symbolic: false,
//   scope: 'refs/remotes',
//   namespace: 'refs',
//   category: 'remotes',
//   remote: 'origin',
//   ref: 'refs/remotes/origin/main',
//   oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
// }
```

##### `reader.isOid(value)`

Checks if a `value` is a valid oid.

```js
reader.isOid('7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'); // true
reader.isOid('main'); // false
```

##### `reader.listRemotes()`

```js
const remotes = reader.listRemotes();
// [
//   'origin'
// ]
```

##### `reader.listRemoteBranches(remote, withOid?)`

Get a list of branches for a remote.

```js
const originBranches = await reader.listRemoteBranches('origin');
// [
//   'HEAD',
//   'main'
// ]

const originBranches = await reader.listRemoteBranches('origin', true);
// [
//   { name: 'HEAD', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'main', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

##### `reader.listBranches(withOid?)`

Get a list of local branches.

```js
const localBranches = await reader.listBranches();
// [
//   'HEAD',
//   'main'
// ]

const localBranches = await reader.listBranches(true);
// [
//   { name: 'HEAD', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'main', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

##### `reader.listTags(withOid?)`

Get a list of tags.

```js
const tags = await reader.listTags();
// [
//   'v1.0.0',
//   'some-feature'
// ]

const tags = await reader.listTags(true);
// [
//   { name: 'v1.0.0', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'some-feature', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

---

#### Trees (file lists) methods

##### `reader.treeOidFromRef(ref)`

Resolves a Git reference (e.g., branch name, tag, commit, or SHA-1 hash) to the object ID (OID) of the corresponding tree.

- **`ref`**: `string` – The reference, SHA-1 hash, or object ID to resolve.

Behavior:

- If the reference points to an annotated tag, the method resolves the tag to its underlying object
- If the reference resolves to a commit, the method retrieves the tree associated with the commit
- If the reference resolves directly to a tree, the tree OID is returned
- Throws an error if the resolved object is not a tree, commit, or tag

```js
const treeOid = await reader.treeOidFromRef('HEAD');
// 'a1b2c3d4e5f6...'

// Error handling
try {
  const invalidTreeOid = await reader.treeOidFromRef('nonexistent-ref');
} catch (error) {
  console.error(error.message); // "Object 'nonexistent-ref' must be a 'tree' but ..."
}
```

##### `reader.listFiles(ref, filesWithHash)`

List all files in the repository at the specified commit reference.

- `ref`: string (default: `'HEAD'`) – commit reference
- `filesWithHash`: boolean (default: `false`) – specify to return blob's hashes

```js
const headFiles = reader.listFiles(); // the same as reader.listFiles('HEAD')
// [ 'file.ext', 'path/to/file.ext', ... ]

const headFilesWithHashes = reader.listFiles('HEAD', true);
// [ { path: 'file.ext', hash: 'f2e492a3049...' }, ... ]
```

##### `reader.getPathEntry(path, ref)`

Retrieve a tree entry (file or directory) by its path at the specified commit reference.

- `path`: string - the path to the file or directory
- `ref`: string (default: `'HEAD'`) - commit reference

```js
const entry = await reader.getPathEntry('path/to/file.txt');
// { isTree: false, path: 'path/to/file.txt', hash: 'a1b2c3d4e5f6...' }
```

##### `reader.getPathsEntries(paths, ref)`

Retrieve a list of tree entries (files or directories) by their paths at the specified commit reference.

- `paths`: string[] - an array of paths to files or directories
- `ref`: string (default: `'HEAD'`) - commit reference

```js
const entries = await reader.getPathsEntries([
  'path/to/file1.txt',
  'path/to/dir1',
  'path/to/file2.txt'
]);
// [
//   { isTree: false, path: 'path/to/file1.txt', hash: 'a1b2c3d4e5f6...' },
//   { isTree: true, path: 'path/to/dir1', hash: 'b1c2d3e4f5g6...' },
//   { isTree: false, path: 'path/to/file2.txt', hash: 'c1d2e3f4g5h6...' }
// ]
```

##### `reader.deltaFiles(nextRef, prevRef)`

Compute the file delta (changes) between two commit references, including added, modified, and removed files.

- `nextRef`: string (default: `'HEAD'`) - commit reference for the "next" state
- `prevRef`: string (optional) - commit reference for the "previous" state

```js
const fileDelta = await reader.deltaFiles('HEAD', 'branch-name');
// {
//   add: [ { path: 'path/to/new/file.txt', hash: 'a1b2c3d4e5f6...' }, ... ],
//   modify: [ { path: 'path/to/modified/file.txt', hash: 'f1e2d3c4b5a6...', prevHash: 'a1b2c3d4e5f6...' }, ... ],
//   remove: [ { path: 'path/to/removed/file.txt', hash: 'a1b2c3d4e5f6...' }, ... ]
// }
```

---

#### Commit methods

##### `reader.commitOidFromRef(ref)`

Resolves a Git reference (e.g., branch name, tag, or SHA-1 hash) to the object ID (OID) of the corresponding commit.

- **`ref`**: `string` – The reference, SHA-1 hash, or object ID to resolve.

Behavior:

- If the reference points to an annotated tag, the method resolves the tag to its underlying commit.
- Throws an error if the reference does not resolve to a valid commit.

```js
const commitOid = await reader.commitOidFromRef('HEAD');
// '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'

// Error handling
try {
  const invalidCommitOid = await reader.commitOidFromRef('nonexistent-ref');
} catch (error) {
  console.error(error.message); // "Object 'nonexistent-ref' must be a 'commit' but ..."
}
```

##### `reader.readCommit(ref)`

Reads and resolves a commit object identified by a reference (e.g., branch name, tag, or SHA-1 hash).

- **`ref`**: `string` – The reference, SHA-1 hash, or object ID of the commit.

```js
const commit = await reader.readCommit('HEAD');
// {
//     oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e',
//     tree: '20596d5c9e037844ae2b707a4a1cb45c72e70e7f',
//     parent: ['8bb6e23769902199e39ab70f2441841712cbdd62'],
//     author: { name: 'John Doe', email: 'john@example.com', timestamp: 1680390225, timezone: '+0200' },
//     committer: { name: 'Jane Doe', email: 'jane@example.com', timestamp: 1680392225, timezone: '+0200' },
//     message: 'Initial commit',
//     gpgsig: '-----BEGIN PGP SIGNATURE-----...'
// }
```

##### `reader.log(options)`

Returns a list of commits in topological order, starting from the specified reference.

- **`options`**: An object with the following properties:
  - **`ref`**: `string` _(default: `'HEAD'`)_ – The reference, SHA-1 hash, or object ID to start from.
  - **`depth`**: `number` _(default: `50`)_ – Limits the number of commits to retrieve. Pass `Infinity` to retrieve all reachable commits.

```js
const commits = await reader.log({ ref: 'my-branch', depth: 10 });
// [
//     { oid: 'a1b2c3d4...', tree: '...', parent: [...], author: {...}, committer: {...}, message: '...' },
//     { oid: 'b2c3d4e5...', tree: '...', parent: [...], author: {...}, committer: {...}, message: '...' },
//     ...
// ]
```

To retrieve all commits reachable from a `ref`, set the `depth` option to `Infinity`.

```js
const allCommits = await reader.log({ ref: 'my-branch', depth: Infinity });
console.log(allCommits.length); // All reachable commits
```

---

#### Misc methods

##### `reader.readObjectHeaderByHash(hash)`

Reads and returns the header of a Git object by its hash.

- **`hash`**: `Buffer` – The SHA-1 hash of the object

```js
const hash = Buffer.from('8bb6e23769902199e39ab70f2441841712cbdd62', 'hex');
const header = await reader.readObjectHeaderByHash(hash);
// { type: 'commit', length: 123 }
```

##### `reader.readObjectByHash(hash, cache?)`

Reads and returns the complete content of a Git object by its hash.

- **`hash`**: `Buffer` – The SHA-1 hash of the object
- **`cache`**: `boolean` _(optional)_ – Whether to use reader's caching (default: `true`)

```js
const hash = Buffer.from('8bb6e23769902199e39ab70f2441841712cbdd62', 'hex');
const object = await reader.readObjectByHash(hash);
// { type: 'blob', object: <Buffer ...> }
```

##### `reader.readObjectHeaderByOid(oid)`

Reads and returns the header of a Git object by its OID (Object ID).

- **`oid`**: `string` – The Object ID of the Git object

```js
const header = await reader.readObjectHeaderByOid('8bb6e23769902199e39ab70f2441841712cbdd62');
// { type: 'tree', length: 45 }
```

##### `reader.readObjectByOid(oid, cache?)`

Reads and returns the complete content of a Git object by its OID.

- **`oid`**: `string` – The Object ID of the Git object.
- **`cache`**: `boolean` _(optional)_ – Whether to use reader's caching (default: `true`).

```js
const object = await reader.readObjectByOid('8bb6e23769902199e39ab70f2441841712cbdd62');
// { type: 'tree', object: <Buffer ...> }
```

##### `reader.stat()`

Retrieves repository statistics, including refs, objects, and files.

```js
const stats = await reader.stat();
/*
{
    size: 163937,
    refs: {
        remotes: [
            { remote: "origin", branches: ["HEAD", "main", ...] },
            ...
        ],
        branches: ["main", "foo", "bar", ...],
        tags: ["tag1", "tag2", ...]
    },
    objects: {
        count: 322,
        size: 145569,
        unpackedSize: 446973,
        unpackedRestoredSize: 755430,
        types: [
            { type: "tree", count: 23, size: 7537, unpackedSize: 8929, unpackedRestoredSize: 0 },
            ...
        ]
        loose: {
            objects: { count: 19, size: 15407, unpackedSize: 40312, unpackedRestoredSize: 0, types: [...] },
            files: [
                {
                    path: "objects/20/596d5c9e037844ae2b707a4a1cb45c72e70e7f",
                    size: 536,
                    object: { oid: "20596d5c9e037844ae2b707a4a1cb45c72e70e7f", type: "tree", length: 606 }
                },
                ...
            ]
        },
        packed:{
            objects: { ... },
            files: [
                {
                    path: "objects/pack/pack-43bc2b9ae5b7a56ab22e849c6c1dfaa00ba72ab1.pack",
                    size: 130194,
                    objects: { ... },
                    index: {
                        path: "objects/pack/pack-43bc2b9ae5b7a56ab22e849c6c1dfaa00ba72ab1.idx",
                        size: 9556,
                        namesBytes: 6060,
                        offsetsBytes: 1212,
                        largeOffsetsBytes: 0
                    },
                    reverseIndex: {
                        path: "objects/pack/pack-43bc2b9ae5b7a56ab22e849c6c1dfaa00ba72ab1.rev",
                        size: 1264
                    }
                },
                ...
            ]
        }
    },
    files: [
        { path: 'config', size: 123 },
        { path: 'objects/pack/pack-a1b2c3d4.pack', size: 456789 },
        { path: 'refs/heads/main', size: 45 }
    ]
}
*/
```

---

### Utils

#### `isGitDir(dir)`

Checks whether the specified directory is a valid Git directory. Returns `true` if the directory contains the necessary files and subdirectories to be a valid Git directory (e.g. `objects`, `refs`, `HEAD`, and `config`), `false` otherwise.

- **`dir`**: `string` – The path to the directory to check.

```js
import { isGitDir } from '@discoveryjs/scan-git';

const isValidGitDir = await isGitDir('/path/to/repo/.git');
console.log(isValidGitDir); // true or false
```

#### `resolveGitDir(dir)`

Resolves the path to the Git directory for the specified input directory.

- **`dir`**: `string` – The path to the directory to resolve.

Behaviour:

- If the input directory contains a `.git` subdirectory, the method resolves to its path
- If no `.git` subdirectory is found, it resolves the input directory itself, assuming it's already the `.git` directory
- Throws an error if the input path doesn't exist or isn't a directory

```js
import { resolveGitDir } from '@discoveryjs/scan-git';

try {
  const gitDir = await resolveGitDir('/path/to/repo');
  console.log(gitDir); // '/path/to/repo/.git' or '/path/to/repo'
} catch (error) {
  console.error(error.message);
}
```

#### `parseContributor(input)`

Parses a string representation of a Git contributor into a structured object.

- **`input`**: `string` – A contributor string in the format `Name <email> timestamp timezone`

```js
import { parseContributor } from '@discoveryjs/scan-git';

const contributor = parseContributor('John Doe <john.doe@example.com> 1680390225 +0200');
// {
//     name: 'John Doe',
//     email: 'john.doe@example.com',
//     timestamp: 1680390225,
//     timezone: '+0200'
// }
```

#### `parseTimezone(offset)`

Parses a Git timezone offset string into a numeric offset in minutes.

- **`offset`**: `string` – A timezone string in the format `+hhmm` or `-hhmm`.

```js
import { parseTimezone } from '@discoveryjs/scan-git';

const timezoneOffset = parseTimezone('+0200');
console.log(timezoneOffset); // 120
```

#### `parseAnnotatedTag(object)`

Parses a buffer representing an annotated Git tag into a structured object.

- **`object`**: `Buffer` – The tag object buffer.

```js
import { parseAnnotatedTag } from '@discoveryjs/scan-git';

const tagObject = await reader.readObjectByOid('7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e');
const tag = parseAnnotatedTag(tagObject.content);
// {
//     tag: 'v1.0.0',
//     type: 'tag',
//     object: 'a1b2c3d4e5f6g7h8i9j0',
//     tagger: { name: 'John Doe', email: 'john@example.com', timestamp: 1680390225, timezone: '+0200' },
//     message: 'Initial release',
//     gpgsig: '-----BEGIN PGP SIGNATURE-----...'
// }
```

#### `parseCommit(object)`

Parses a buffer representing a Git commit into a structured object.

- **`object`**: `Buffer` – The commit object buffer.

```js
import { parseCommit } from '@discoveryjs/scan-git';

const commitObject = await reader.readObjectByOid('7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e');
const commit = parseCommit(commitObject.content);
// {
//     tree: 'a1b2c3d4e5f6g7h8i9j0',
//     parent: ['b2c3d4e5f6g7h8i9j0k1'],
//     author: { name: 'John Doe', email: 'john@example.com', timestamp: 1680390225, timezone: '+0200' },
//     committer: { name: 'John Doe', email: 'john@example.com', timestamp: 1680390225, timezone: '+0200' },
//     message: 'Fix a critical bug',
//     gpgsig: '-----BEGIN PGP SIGNATURE-----...'
// }
```

#### `parseTree(buffer)`

Parses a buffer representing a Git tree object into a structured array of entries.

- **`buffer`**: `Buffer` – The tree object buffer.

```js
import { parseTree } from '@discoveryjs/scan-git';

const treeObject = await reader.readObjectByOid('7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e');
const tree = parseTree(treeObject.content);
// [
//     { isTree: true, path: 'src', hash: <Buffer ...> },
//     { isTree: false, path: 'README.md', hash: <Buffer ...> }
// ]
```

## Features and comparation

| scan-git | isomorphic-git | Feature                                                                                                                                                                                                                   |
| :------: | :------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    ✅    |       ✅       | loose refs                                                                                                                                                                                                                |
|    ✅    |       ✅       | packed refs                                                                                                                                                                                                               |
|    🚫    |       ✅       | [index file] <br><sub>Boosts fetching a file list for HEAD</sub>                                                                                                                                                          |
|    ✅    |       ✅       | loose objects                                                                                                                                                                                                             |
|    ✅    |       ✅       | packed objects (`*.pack` + `*.idx` files)                                                                                                                                                                                 |
|    ✅    |       🚫       | [2Gb+ packs support] <br><sub>Version 2 `pack-*.idx` files support packs larger than 4 GiB by adding an optional table of 8-byte offset entries for large offsets</sub>                                                   |
|    ✅    |       🚫       | [On-disk reverse indexes] (`*.rev` files) <br><sub>Reverse index is boosting operations such as a seeking an object by offset or scanning objects in a pack order</sub>                                                   |
|    🚫    |       🚫       | [multi-pack-index] (MIDX) <br><sub>Stores a list of objects and their offsets into multiple packfiles, can provide O(log N) lookup time for any number of packfiles</sub>                                                 |
|    🚫    |       🚫       | [multi-pack-index reverse indexes] (RIDX) <br><sub>Similar to the pack-based reverse index</sub>                                                                                                                          |
|    ✅    |       🚫       | [Cruft packs] <br><sub>A cruft pack eliminates the need for storing unreachable objects in a loose state by including the per-object mtimes in a separate file alongside a single pack containing all loose objects</sub> |
|    🚫    |       🚫       | [Pack and multi-pack bitmaps] <br><sub>Bitmaps store reachability information about the set of objects in a packfile, or a multi-pack index</sub>                                                                         |
| 🚫 (TBD) |       🚫       | [commit-graph] <br><sub>A binary file format that creates a structured representation of Git’s commit history, optimizes some operations</sub>                                                                            |

[index file]: https://git-scm.com/docs/index-format
[2gb+ packs support]: https://git-scm.com/docs/pack-format#_version_2_pack_idx_files_support_packs_larger_than_4_gib_and
[on-disk reverse indexes]: https://github.blog/2021-03-15-highlights-from-git-2-31/
[multi-pack-index]: https://git-scm.com/docs/multi-pack-index
[multi-pack-index reverse indexes]: https://git-scm.com/docs/pack-format#_multi_pack_index_reverse_indexes
[cruft packs]: https://git-scm.com/docs/cruft-packs
[pack and multi-pack bitmaps]: https://github.blog/2021-11-15-highlights-from-git-2-34/#multi-pack-reachability-bitmaps
[commit-graph]: https://devblogs.microsoft.com/devops/updates-to-the-git-commit-graph-feature/

## License

MIT
