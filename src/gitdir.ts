import { stat } from 'fs/promises';
import { join, resolve } from 'path';

const test = {
    objects: 'dir',
    refs: 'dir',
    HEAD: 'file',
    config: 'file'
};

export async function isGitDir(dir: string) {
    try {
        const stats = await Promise.all(Object.keys(test).map((name) => stat(join(dir, name))));

        return Object.values(test).every((type, idx) =>
            type === 'dir' ? stats[idx].isDirectory() : stats[idx].isFile()
        );
    } catch {
        return false;
    }
}

export async function resolveGitDir(dir: string) {
    const absdir = resolve(process.cwd(), dir);
    let absdirStat;

    try {
        absdirStat = await stat(absdir);
    } catch {
        throw new Error(`No such directory "${absdir}"`);
    }

    if (!absdirStat.isDirectory()) {
        throw new Error(`Not a directory "${absdir}"`);
    }

    try {
        const dotGitDir = join(absdir, '.git');
        await stat(dotGitDir);
        return dotGitDir;
    } catch {}

    return absdir;
}
