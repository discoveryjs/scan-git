import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, parseTree } from '../../lib/index.js';

const repo = await createGitReader(fileURLToPath(new URL('_git', import.meta.url)));
const commits = await repo.log();
const objects = {};
const filesLists = {};
const filesDelta = {};

for (const commit of commits) {
    objects[commit.oid] = commit;
    objects[commit.tree] = parseTree((await repo.readObjectByOid(commit.tree)).object);
    filesLists[commit.oid] = (await repo.listFiles(commit.oid)).sort();
    filesDelta[commit.oid] = await repo.deltaFiles(commit.oid);
    filesDelta[commit.oid].add.sort();
    filesDelta[commit.oid].modify.sort();
    filesDelta[commit.oid].remove.sort();
}

fs.writeFileSync(
    fileURLToPath(new URL('data.json', import.meta.url)),
    JSON.stringify(
        {
            commits,
            filesLists,
            filesDelta,
            objects
        },
        null,
        4
    )
);
