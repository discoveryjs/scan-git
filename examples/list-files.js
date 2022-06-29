import { gitDir } from './get-git-dir.js';
import { createGitReader } from '../lib/index.js';

const repo = await createGitReader(gitDir);

console.log('createGitReader:', repo.initTime, 'ms');

async function example(oneMoreRun) {
    const startTime = Date.now();
    const files = await repo.listFiles();

    console.log();
    console.log(oneMoreRun ? '[COLD RUN]' : '[HOT RUN]');
    console.log(
        files.length,
        'files in',
        Date.now() - startTime,
        'ms, mem:',
        process.memoryUsage()
    );

    if (oneMoreRun) {
        example();
    }
}

example(true);
