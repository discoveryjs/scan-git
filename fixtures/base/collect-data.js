import assert from 'assert';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, parseTree } from '../../lib/index.js';

const repo = await createGitReader(fileURLToPath(new URL('_git', import.meta.url)));
const defaultBranch = await repo.defaultBranch();
const currentBranch = await repo.currentBranch();
const commits = await repo.log();
const stat = await repo.stat();
const objects = {};
const filesLists = {};
const filesDelta = {};

for (const commit of commits) {
    objects[commit.oid] = commit;
    objects[commit.tree] = parseTree((await repo.readObjectByOid(commit.tree)).object);
    objects[commit.tree].forEach((entry) => (entry.hash = entry.hash.toString('hex')));
    filesLists[commit.oid] = (await repo.listFiles(commit.oid)).sort();
    filesDelta[commit.oid] = await repo.deltaFiles(commit.oid);
    filesDelta[commit.oid].add.sort();
    filesDelta[commit.oid].modify.sort();
    filesDelta[commit.oid].remove.sort();
}

// ensure heads/loose-and-packed exists in loose and packed forms with different oids
const looseLap = fs
    .readFileSync(new URL('_git/refs/heads/loose-and-packed', import.meta.url), 'utf8')
    .trim();
const packedLap = fs
    .readFileSync(new URL('_git/packed-refs', import.meta.url), 'utf8')
    .match(/\n(\S+) refs\/heads\/loose-and-packed\n/)[1];

assert.strictEqual(looseLap.length, 40);
assert.strictEqual(packedLap.length, 40);
assert.notStrictEqual(looseLap, packedLap);

// dump data to a file
fs.writeFileSync(
    fileURLToPath(new URL('data.json', import.meta.url)),
    JSON.stringify(
        {
            defaultBranch,
            currentBranch,
            commits,
            filesLists,
            filesDelta,
            objects,
            stat
        },
        null,
        4
    )
);
