import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const fixtures = [
    {
        name: 'self',
        url: 'https://github.com/discoveryjs/scan-git.git',
        commit: '5eeaa4f0852ebaee139f90e1e4740fec4b6587df',
        prevCommit: '476713943b4ccf7a87aea5b81114e0ee2c0d00b9'
    },
    {
        name: 'react',
        url: 'https://github.com/facebook/react.git',
        commit: '02206099afe9bf54435fe0bd978a4ccf3df9cace',
        prevCommit: '4bc83e682119085481a7c940d23c5f1568be002b'
    },
    {
        name: 'vscode',
        url: 'https://github.com/microsoft/vscode.git',
        commit: '78397428676e15782e253261358b0398c2a1149e',
        prevCommit: '015d6b8e622e41b0e73539f3976b6f7d02012b4c'
    }
].map((fixtureBase, index) => {
    const fixture = {
        index,
        path: `${new URL('.', import.meta.url).pathname}fixtures/${fixtureBase.name}`,
        ...fixtureBase
    };

    Object.defineProperty(fixture, 'ensureReady', {
        value() {
            if (!fs.existsSync(fixture.path)) {
                const outputDir = path.relative(process.cwd(), fixture.path);

                console.log('Fixture is not ready - initing...');
                spawnSync('git', ['clone', '-n', fixture.url, outputDir], {
                    stdio: 'inherit'
                });
            }
        }
    });

    return fixture;
});

// fixtures[0].ensureReady();
