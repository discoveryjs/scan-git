import esMain from 'es-main';
import { createBenchmark } from './utils/run-benchmark.js';
import { fixtures } from './fixtures.js';

export const benchmark = createBenchmark({
    name: 'stat',
    fixtures,
    libs: ['@discoveryjs/scan-git', 'simple-git', 'isomorphic-git'],
    async bootstrap(libName, fixture) {
        switch (libName) {
            case '@discoveryjs/scan-git': {
                const { createGitReader } = await import('@discoveryjs/scan-git');
                const repo = await createGitReader(fixture.path + '/.git');

                return {
                    stat() {
                        return repo.stat();
                    }
                };
            }

            case 'simple-git': {
                const { simpleGit } = await import('simple-git');
                const git = simpleGit(fixture.path);

                return {
                    async stat() {
                        const [branches, tags, objectStats] = await Promise.all([
                            git.branch(['-a']),
                            git.tags(),
                            git.raw('count-objects', '-v', '-H')
                        ]);

                        return {
                            branches,
                            tags,
                            objectStats
                        };
                    }
                };
            }

            case 'isomorphic-git': {
                const fs = await import('node:fs');
                const git = await import('isomorphic-git');
                const dir = fixture.path;

                return {
                    async stat() {
                        const [localBranches, tags, remotes] = await Promise.all([
                            git.listBranches({
                                fs,
                                dir
                            }),
                            git.listTags({ fs, dir }),
                            git.listRemotes({ fs, dir })
                        ]);

                        const remoteBranches = await Promise.all(
                            remotes.map(({ remote }) =>
                                git
                                    .listBranches({ fs, dir, remote })
                                    .then((branches) =>
                                        branches.map((branch) => remote + '/' + branch)
                                    )
                            )
                        );

                        const branches = [...localBranches, ...remoteBranches.flat(1)];

                        // isomorphic-git doesn't have means to read object stats
                        return {
                            branches,
                            tags
                        };
                    }
                };
            }
        }
    },
    async bench(state) {
        for (let i = 0; i < 10; i++) {
            await state.stat();
        }
    }
});

if (esMain(import.meta)) {
    benchmark.run();
}
