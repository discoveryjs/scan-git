import esMain from 'es-main';
import { createBenchmark } from './utils/run-benchmark.js';
import { fixtures } from './fixtures.js';

export const benchmark = createBenchmark({
    name: 'list-files',
    fixtures,
    libs: ['@discoveryjs/scan-git', 'isomorphic-git'],
    async bootstrap(libName, fixture) {
        switch (libName) {
            case '@discoveryjs/scan-git': {
                const { createGitReader } = await import('@discoveryjs/scan-git');
                const repo = await createGitReader(fixture.path + '/.git');

                return {
                    listFiles() {
                        return repo.listFiles();
                    }
                };
            }

            case 'isomorphic-git': {
                const fs = await import('node:fs');
                const git = await import('isomorphic-git');
                const dir = fixture.path;

                return {
                    async listFiles() {
                        return git.listFiles({ fs, dir, ref: 'HEAD' });
                    }
                };
            }
        }
    },
    async bench(state, fixture) {
        for (let i = 0; i < 1; i++) {
            await state.listFiles(fixture.commit);
        }
    }
});

if (esMain(import.meta)) {
    benchmark.run();
}
