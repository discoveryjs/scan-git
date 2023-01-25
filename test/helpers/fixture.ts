import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, GitReaderOptions } from '@discoveryjs/scan-git';

const fixturesPath = '../../fixtures/';
const fixtureNames = ['base', 'cruft', 'no-remotes', 'upstream', 'clean'];

export const fixtures = Object.create(null);

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
        data: JSON.parse(
            fs.readFileSync(
                fileURLToPath(new URL(fixturesPath + name + '/data.json', import.meta.url)),
                'utf8'
            )
        )
    };
}
