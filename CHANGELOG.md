## next

- Fixed methods for reading loose objects (`readObjectHeaderByOid`, `readObjectHeaderByHash`, `readObjectByOid`
  and `readObjectByHash`) that were not working in some cases due to incorrect formation of the fanout table when `fs.readdir()` returns an unsorted list of entries
- Fixed `listRemotes()` method to always return a sorted list of remotes

## 0.1.0 (2022-09-12)

- Initial release
