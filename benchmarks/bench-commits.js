import esMain from 'es-main';
import { createBenchmark } from './utils/run-benchmark.js';
import { fixtures } from './fixtures.js';

export const benchmark = createBenchmark({
    name: 'commits',
    fixtures,
    libs: ['@discoveryjs/scan-git', 'simple-git', 'isomorphic-git'],
    async bootstrap(libName, fixture) {
        switch (libName) {
            case '@discoveryjs/scan-git': {
                const { createGitReader } = await import('@discoveryjs/scan-git');
                const repo = await createGitReader(fixture.path + '/.git');

                return {
                    async commits() {
                        const commits = await repo.log({
                            depth: Infinity
                        });

                        return commits.length;
                    }
                };
            }

            case 'simple-git': {
                const { simpleGit } = await import('simple-git');
                const git = simpleGit(fixture.path);

                return {
                    async commits() {
                        const commits = await git.log();

                        return commits.total;
                    }
                };
            }

            case 'isomorphic-git': {
                const fs = await import('node:fs');
                const git = await import('isomorphic-git');
                const dir = fixture.path;

                return {
                    async commits() {
                        const commits = await git.log({ fs, dir });

                        return commits.length;
                    }
                };
            }
        }
    },
    async bench(state) {
        for (let i = 0; i < 10; i++) {
            await state.commits();
        }
    }
});

if (esMain(import.meta)) {
    benchmark.run();
}
