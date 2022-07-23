import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader } from '@discoveryjs/scan-git';

const fixturesConfig = {
    base: '../../fixtures/base'
};

export const fixtures = Object.create(null);

for (const [name, path] of Object.entries(fixturesConfig)) {
    fixtures[name] = {
        repo: createGitReader(fileURLToPath(new URL(path + '/_git', import.meta.url))),
        data: JSON.parse(
            fs.readFileSync(fileURLToPath(new URL(path + '/data.json', import.meta.url)), 'utf8')
        )
    };
}
