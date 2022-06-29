import { createGitReader } from '../lib/index.js';
import { gitDir } from './get-git-dir.js';

const repo = await createGitReader(gitDir);

console.log('createGitReader:', repo.initTime, 'ms');

async function example() {
    const startTime = Date.now();
    const stats = await repo.stat();

    console.log('Done in', Date.now() - startTime, 'ms');
    console.log(process.memoryUsage());

    console.log('loose objects:', stats.objects.loose.objects.count);
    console.log('packed objects:', stats.objects.packed.objects.count);

    // writeFileSync('./stat.json', JSON.stringify(stats), 'utf8');
}

example();
