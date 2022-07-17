import esMain from 'es-main';
import { createBenchmark } from './utils/run-benchmark.js';
import { fixtures } from './fixtures.js';

export const benchmark = createBenchmark({
    name: 'commit-delta-files',
    fixtures,
    libs: ['@discoveryjs/scan-git', 'simple-git', 'isomorphic-git'],
    async bootstrap(libName, fixture) {
        switch (libName) {
            case '@discoveryjs/scan-git': {
                const { createGitReader } = await import('@discoveryjs/scan-git');
                const repo = await createGitReader(fixture.path + '/.git');

                return {
                    deltaFiles(nextRef, prevRef) {
                        return repo.deltaFiles(nextRef, prevRef);
                    }
                };
            }

            case 'simple-git': {
                const { simpleGit } = await import('simple-git');
                const git = simpleGit(fixture.path);

                return {
                    async deltaFiles(nextRef, prevRef) {
                        const output = await git.diff(['--name-status', prevRef, nextRef]);
                        return output
                            .trim()
                            .split('\n')
                            .map((line) => {
                                const [status, , ...rest] = line.split(/(\s+)/);
                                return { status, path: rest.join('') };
                            });
                    }
                };
            }

            case 'isomorphic-git': {
                const fs = await import('node:fs');
                const git = await import('isomorphic-git');
                const dir = fixture.path;
                const cache = {};

                return {
                    async deltaFiles(commitHash1, commitHash2) {
                        // https://isomorphic-git.org/docs/en/snippets#git-diff-name-status-commithash1-commithash2
                        return git.walk({
                            fs,
                            dir,
                            cache,
                            trees: [git.TREE({ ref: commitHash1 }), git.TREE({ ref: commitHash2 })],
                            async map(filepath, [A, B]) {
                                // ignore directories
                                if (filepath === '.') {
                                    return;
                                }
                                if ((await A.type()) === 'tree' || (await B.type()) === 'tree') {
                                    return;
                                }

                                // generate ids
                                const Aoid = await A.oid();
                                const Boid = await B.oid();

                                // determine modification type
                                let type = 'equal';
                                if (Aoid !== Boid) {
                                    type = 'modify';
                                }
                                if (Aoid === undefined) {
                                    type = 'add';
                                }
                                if (Boid === undefined) {
                                    type = 'remove';
                                }
                                if (Aoid === undefined && Boid === undefined) {
                                    console.log('Something weird happened:');
                                    console.log(A);
                                    console.log(B);
                                }

                                if (type === 'equal') {
                                    return;
                                }

                                return {
                                    path: `/${filepath}`,
                                    type: type
                                };
                            }
                        });
                    }
                };
            }
        }
    },
    async bench(state, fixture) {
        for (let i = 0; i < 10; i++) {
            await state.deltaFiles(fixture.commit, fixture.prevCommit);
            // const res = await state.deltaFiles(fixture.commit, fixture.prevCommit);
            // console.log(res.length || res.add.length + res.remove.length + res.modify.length);
            // console.log(res?.slice(0, 10));
        }
    }
});

if (esMain(import.meta)) {
    benchmark.run();
}
