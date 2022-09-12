import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, GitReaderOptions } from '@discoveryjs/scan-git';

const fixturesPath = '../../fixtures/';
const fixtureNames = ['base', 'cruft', 'no-remotes', 'upstream', 'clean'];

export const fixtures = Object.create(null);

for (const name of fixtureNames) {
    fixtures[name] = {
        repo: (options?: GitReaderOptions) =>
            createGitReader(
                fileURLToPath(new URL(fixturesPath + name + '/_git', import.meta.url)),
                options
            ),
        data: JSON.parse(
            fs.readFileSync(
                fileURLToPath(new URL(fixturesPath + name + '/data.json', import.meta.url)),
                'utf8'
            )
        )
    };
}
