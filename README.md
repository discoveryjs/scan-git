# @discoveryjs/scan-git

[![NPM version](https://img.shields.io/npm/v/@discoveryjs/scan-git.svg)](https://www.npmjs.com/package/@discoveryjs/scan-git)
[![Build](https://github.com/discoveryjs/scan-git/actions/workflows/build.yml/badge.svg)](https://github.com/discoveryjs/scan-git/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/discoveryjs/scan-git/badge.svg?branch=main)](https://coveralls.io/github/discoveryjs/scan-git?branch=main)

## Usage

```
npm install @discoveryjs/scan-git
```

## API

```js
import { createGitReader } from '@discoveryjs/scan-git';

const repo = await createGitReader('path/to/.git');
const commits = await repo.log({ ref: 'my-branch', depth: 10 });

console.log(commits);

await repo.dispose();
```

#### createGitReader(gitdir, options?)

- `gitdir`: string - path to the git repo
- `options` – optional settings:
  - `cruftPacks` – defines how [cruft packs](https://git-scm.com/docs/cruft-packs) are processed:
    - `'include'` or `true` (default) - process all packs
    - `'exclude'` or `false` - exclude cruft packs from processing
    - `'only'` - process cruft packs only

### Refs

Common parameters:

- `ref`: string – a reference to an object in repository
- `withOid`: boolean – a flag to include resolved oid for a reference

#### repo.defaultBranch()

Returns default branch name used in a repo:

```js
const defaultBranch = await repo.defaultBranch();
// 'main'
```

The algorithm to identify a default branch name:

- if there is only one branch, that must be the default
- otherwise looking for specific branch names, in this order:
  - `upstream/HEAD`
  - `origin/HEAD`
  - `main`
  - `master`

#### repo.isRefExists(ref)

Checks if a `ref` exists.

```js
const isValidRef = repo.isRefExists('main');
// true
```

#### repo.expandRef(ref)

Expands a `ref` into a full form, e.g. `'main'` -> `'refs/heads/main'`.
Returns `null` if `ref` doesn't exist. For the symbolic ref names (`'HEAD'`, `'FETCH_HEAD'`, `'CHERRY_PICK_HEAD'`, `'MERGE_HEAD'` and `'ORIG_HEAD'`) returns a name without changes.

```js
const fullPath = repo.expandRef('heads/main');
// 'refs/heads/main'
```

#### repo.resolveRef(ref)

Resolves `ref` into oid if it exists, otherwise throws an exception.
In case if `ref` is oid, returns this oid back. If ref is not a full path, expands it first.

```js
const oid = repo.resolveRef('main');
// '8bb6e23769902199e39ab70f2441841712cbdd62'
```

#### repo.describeRef(ref)

Returns an info object for provided `ref`.

```js
const info = repo.describeRef('HEAD');
// {
//   path: 'HEAD',
//   name: 'HEAD',
//   symbolic: true,
//   ref: 'refs/heads/test',
//   oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
// }
```

```js
const info = repo.describeRef('main');
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
const info = repo.describeRef('origin/HEAD');
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
```

#### repo.listRemotes()

```js
const remotes = repo.listRemotes();
// [
//   'origin'
// ]
```

#### repo.listRemoteBranches(remote, withOid?)

Get a list of branches for a remote.

```js
const originBranches = await repo.listRemoteBranches('origin');
// [
//   'HEAD',
//   'main'
// ]

const originBranches = await repo.listRemoteBranches('origin', true);
// [
//   { name: 'HEAD', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'main', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

#### repo.listBranches(withOid?)

Get a list of local branches.

```js
const localBranches = await repo.listBranches();
// [
//   'HEAD',
//   'main'
// ]

const localBranches = await repo.listBranches(true);
// [
//   { name: 'HEAD', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'main', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

#### repo.listTags(withOid?)

Get a list of tags.

```js
const tags = await repo.listTags();
// [
//   'v1.0.0',
//   'some-feature'
// ]

const tags = await repo.listTags(true);
// [
//   { name: 'v1.0.0', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' }
//   { name: 'some-feature', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' }
// ]
```

## File lists

#### repo.treeOidFromRef(ref)

Resolve a tree oid by a commit reference.

- `ref`: string (default: `'HEAD'`) – commit reference

```js
const treeOid = await repo.treeOidFromRef('HEAD');
// 'a1b2c3d4e5f6...'
```

#### repo.listFiles(ref, filesWithHash)

List all files in the repository at the specified commit reference.

- `ref`: string (default: `'HEAD'`) – commit reference
- `filesWithHash`: boolean (default: `false`) – specify to return blob's hashes

```js
const headFiles = repo.listFiles(); // the same as repo.listFiles('HEAD')
// [ 'file.ext', 'path/to/file.ext', ... ]

const headFilesWithHashes = repo.listFiles('HEAD', true);
// [ { path: 'file.ext', hash: 'f2e492a3049...' }, ... ]
```

#### repo.getPathEntry(path, ref)

Retrieve a tree entry (file or directory) by its path at the specified commit reference.

- `path`: string - the path to the file or directory
- `ref`: string (default: `'HEAD'`) - commit reference

```js
const entry = await repo.getPathEntry('path/to/file.txt');
// { isTree: false, path: 'path/to/file.txt', hash: 'a1b2c3d4e5f6...' }
```

#### repo.getPathsEntries(paths, ref)

Retrieve a list of tree entries (files or directories) by their paths at the specified commit reference.

- `paths`: string[] - an array of paths to files or directories
- `ref`: string (default: `'HEAD'`) - commit reference

```js
const entries = await repo.getPathsEntries([
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

#### repo.deltaFiles(nextRef, prevRef)

Compute the file delta (changes) between two commit references, including added, modified, and removed files.

- `nextRef`: string (default: `'HEAD'`) - commit reference for the "next" state
- `prevRef`: string (optional) - commit reference for the "previous" state

```js
const fileDelta = await repo.deltaFiles('HEAD', 'branch-name');
// {
//   add: [ { path: 'path/to/new/file.txt', hash: 'a1b2c3d4e5f6...' }, ... ],
//   modify: [ { path: 'path/to/modified/file.txt', hash: 'f1e2d3c4b5a6...', prevHash: 'a1b2c3d4e5f6...' }, ... ],
//   remove: [ { path: 'path/to/removed/file.txt', hash: 'a1b2c3d4e5f6...' }, ... ]
// }
```

### Commits

#### repo.readCommit(ref)

#### repo.log(options)

Return a list of commits in topological order.

Options:

- `ref` – oid, hash, ref
- `depth` (default `50`) – limits commits count

```js
const commits = await repo.log({ ref: 'my-branch', depth: 10 });
// [
//     Commit,
//     Commit,
//     ...
// ]
```

> Note: Pass `Infinity` as `depth` value to load all the commits that are reachable from `ref` at once.

### Statistics & info

#### repo.readObjectHeaderByHash(hash)

#### repo.readObjectByHash(hash, cache?)

#### repo.readObjectHeaderByOid(oid)

#### repo.readObjectByOid(oid, cache?)

#### repo.stat()

Returns statistics for a repo:

```js
const stats = await repo.stat();
// {
//     refs: { ... },
//     objects: {
//         loose: { ... },
//         packed: { ... }
//     }
// }
```

### Utils

#### parseContributor()

#### parseTimezone()

#### parseAnnotatedTag()

#### parseCommit()

#### parseTree()

#### diffTrees()

## Compare

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
| 🚫 (TBD) |       🚫       | [commit-graph] <br><sub>A binary file format that creates a structured representation of Git’s commit history, boost some operations</sub>                                                                                |

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
