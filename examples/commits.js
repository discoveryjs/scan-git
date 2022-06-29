import { createGitReader } from '@discoveryjs/scan-git';
import { gitDir } from './get-git-dir.js';

const repo = await createGitReader(gitDir);

console.log('createGitReader:', repo.initTime, 'ms');

async function collectCommits() {
    const startTime = Date.now();
    // read all commits reachable from HEAD
    const commits = await repo.log({
        ref: 'master',
        depth: Infinity
    });

    console.log(commits.length, 'commits read');
    console.log('time:', Date.now() - startTime, 'ms');
    console.log('mem:', process.memoryUsage());

    // prepare commits data for analysis
    // const commitIdxByOid = commits.reduce((map, commit, idx) => map.set(commit.oid, idx), new Map());
    // for (const commit of commits) {
    //     for (let i = 0; i < commit.parent.length; i++) {
    //         commit.parent[i] = commitIdxByOid.get(commit.parent[i]);
    //     }
    // }

    // writeFileSync(
    //     'commits.json',
    //     JSON.stringify(commits, (key, value) =>
    //         key === 'timezone' || key === 'tree'
    //             ? undefined
    //             : key === 'message' && value.includes('\n')
    //             ? value.slice(0, value.indexOf('\n'))
    //             : value
    //     )
    // );
}

collectCommits();
