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

createGitReader('path/to/.git').then(async (repo) => {
  const commits = await repo.log({ ref: 'my-branch', depth: 10 });

  console.log(commits);
});
```

### Refs

#### repo.resolveRef(ref)

#### repo.expandRef(ref)

#### repo.isRefExists(ref)

#### repo.listRemotes()

#### repo.listBranches(remote?)

#### repo.listTags()

### File lists

#### repo.listFiles(ref, filesWithHash)

- `ref`: string (default: `'HEAD'`) – commit reference
- `filesWithHash`: boolean (default: `false`) – specify to return blob's hashes

```js
const headFiles = repo.listFiles(); // the same as repo.listFiles('HEAD')
// [ 'file.ext', 'path/to/file.ext', ... ]

const headFilesWithHashes = repo.listFiles('HEAD', true);
// [ { path: 'file.ext', hash: 'f2e492a3049...' }, ... ]
```

#### repo.deltaFiles(nextRef, prevRef)

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
|    🚫    |       🚫       | [Cruft packs] <br><sub>A cruft pack eliminates the need for storing unreachable objects in a loose state by including the per-object mtimes in a separate file alongside a single pack containing all loose objects</sub> |
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
