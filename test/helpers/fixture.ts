import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, GitReaderOptions } from '@discoveryjs/scan-git';

type Repo = Awaited<ReturnType<LazyFixture['repo']>>;
type LazyFixture = {
    repo: (options?: GitReaderOptions) => ReturnType<typeof createGitReader>;
    data: any;
};

const fixturesPath = '../../fixtures/';
const fixtureNames = ['base', 'detached', 'cruft', 'no-remotes', 'upstream', 'clean', 'rev-index'];

export const nullRepo: Repo = null as unknown as Repo;
export const fixtures: Record<string, LazyFixture> = Object.create(null);

for (const name of fixtureNames) {
    fixtures[name] = {
        repo: (options?: GitReaderOptions) => {
            const origReaddir = fs.promises.readdir;

            try {
                // Patch readdir method to catch issues when readdir returns unsorted entries
                // @ts-expect-error ts(2322)
                fs.promises.readdir = (...args: Parameters<typeof fs.promises.readdir>) =>
                    origReaddir(...args).then((list) => list.reverse());

                return createGitReader(
                    fileURLToPath(new URL(fixturesPath + name + '/_git', import.meta.url)),
                    options
                );
            } finally {
                fs.promises.readdir = origReaddir;
            }
        },
        get data() {
            const value = JSON.parse(
                fs.readFileSync(
                    fileURLToPath(new URL(fixturesPath + name + '/data.json', import.meta.url)),
                    'utf8'
                )
            );

            Object.defineProperty(this, 'data', { value });

            return value;
        }
    };
}
