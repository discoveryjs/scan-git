## next

- Added `getPathEntry()` method
- Added `getPathsEntries()` method

## 0.1.1 (2023-01-25)

- Fixed methods for reading loose objects (`readObjectHeaderByOid`, `readObjectHeaderByHash`, `readObjectByOid`
  and `readObjectByHash`) that were not working in some cases due to incorrect formation of the fanout table when `fs.readdir()` returns an unsorted list of entries
- Fixed `listRemotes()` method to always return a sorted list of remotes
- Fixed `stat()` method to return stable results disregarding of `fs.readdir()`'s result list order

## 0.1.0 (2022-09-12)

- Initial release
