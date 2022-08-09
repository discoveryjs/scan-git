import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader, GitReaderOptions } from '@discoveryjs/scan-git';

const fixturesConfig = {
    base: '../../fixtures/base',
    cruft: '../../fixtures/cruft'
};

export const fixtures = Object.create(null);

for (const [name, path] of Object.entries(fixturesConfig)) {
    fixtures[name] = {
        repo: (options?: GitReaderOptions) =>
            createGitReader(fileURLToPath(new URL(path + '/_git', import.meta.url)), options),
        data: JSON.parse(
            fs.readFileSync(fileURLToPath(new URL(path + '/data.json', import.meta.url)), 'utf8')
        )
    };
}
