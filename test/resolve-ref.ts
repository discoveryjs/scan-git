import assert from 'assert';
import { fixtures } from './helpers/fixture.js';
import { refFixtures } from './ref-fixtures.js';
import { wrongRefFixtures } from './wrong-ref-fixtures.js';

// ambiguous ref resolving priority
import { shouldBeTag } from './ambiguous-refs-tag.js';
import { shouldBeHead } from './ambiguous-refs-head.js';
import { shouldBeRemoteHead } from './ambiguous-refs-remote-head.js';

describe('resolve-ref', () => {
    let repo;
    before(async () => (repo = await fixtures.base.repo));

    describe('listBranches()', () => {
        it('local branches', async () => {
            const actual = await repo.listBranches();
            const expected = [
                'main',
                'onmain-branch',
                'should-be-head',
                'should-be-tag',
                'test',
                'with-slash/should-be-head',
                'with-slash/should-be-tag'
            ];

            assert.deepStrictEqual(actual, expected);
        });

        it('local branches with oids', async () => {
            const actual = await repo.listBranches(null, true);
            const expected = [
                { name: 'main', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'onmain-branch', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' },
                { name: 'should-be-head', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                {
                    name: 'should-be-tag',
                    oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
                },
                { name: 'test', oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6' },
                {
                    name: 'with-slash/should-be-head',
                    oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
                },
                {
                    name: 'with-slash/should-be-tag',
                    oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
                }
            ];

            assert.deepStrictEqual(actual, expected);
        });

        it('remote branches', async () => {
            const actual = await repo.listBranches('origin');
            const expected = [
                'HEAD',
                'main',
                'should-be-head',
                'should-be-remote-head',
                'should-be-tag',
                'with-slash/should-be-head',
                'with-slash/should-be-tag'
            ];

            assert.deepStrictEqual(actual, expected);
        });

        it('remote branches with oids', async () => {
            const actual = await repo.listBranches('origin', true);
            const expected = [
                { name: 'HEAD', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'main', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'should-be-head', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' },
                { name: 'should-be-remote-head', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                {
                    name: 'should-be-tag',
                    oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
                },
                {
                    name: 'with-slash/should-be-head',
                    oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
                },
                {
                    name: 'with-slash/should-be-tag',
                    oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
                }
            ];

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('listTags()', () => {
        it('tags', async () => {
            const actual = await repo.listTags();
            const expected = [
                'onmain-tag',
                'should-be-tag',
                'test-annotated-tag',
                'test-annotated-tag/packed',
                'test-tag',
                'with-slash/should-be-tag'
            ];

            assert.deepStrictEqual(actual, expected);
        });

        it('tags with oids', async () => {
            const actual = await repo.listTags(true);
            const expected = [
                { name: 'onmain-tag', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' },
                { name: 'should-be-tag', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'test-annotated-tag', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' },
                {
                    name: 'test-annotated-tag/packed',
                    oid: '56ea7a808e35df13e76fee92725a65a373a9835c'
                },
                { name: 'test-tag', oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6' },
                {
                    name: 'with-slash/should-be-tag',
                    oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
                }
            ];

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('listRemotes()', () => {
        it('remotes', async () => {
            const actual = await repo.listRemotes();
            const expected = ['origin', 'with-slash'];

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('resolveRef()', () => {
        it('oid into oid', async () => {
            const oid = '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2';
            const actual = await repo.resolveRef(oid);

            assert.strictEqual(actual, oid);
        });

        describe('ref into oid', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.resolveRef(testCase.ref);
                    const expected = testCase.oid;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('refs starting with "ref: " ', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.resolveRef('ref: ' + testCase.ref);
                    const expected = testCase.oid;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('throws not found error with correct, but broken refs', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, () => {
                    assert.rejects(
                        () => repo.resolveRef(testCase.ref + 'n'),
                        /ref not found refs\/heads\/mainn/
                    );
                });
            }
        });

        describe('throws not found error with wrong ref', () => {
            for (const testCase of wrongRefFixtures) {
                it(testCase.ref, () => {
                    assert.rejects(
                        () => repo.resolveRef(testCase.ref + 'n'),
                        /ref not found refs\/heads\/mainn/
                    );
                });
            }
        });

        describe('shouldBeTag ref for ambiguous refs priority', () => {
            for (const testCase of shouldBeTag) {
                it(testCase.ref, async () => {
                    const actual = await repo.resolveRef(testCase.ref);
                    const expected = testCase.oid;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('shouldBeHead ref for ambiguous refs priority', () => {
            for (const testCase of shouldBeHead) {
                it(testCase.ref, async () => {
                    const actual = await repo.resolveRef(testCase.ref);
                    const expected = testCase.oid;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('shouldBeRemoteHead ref for ambiguous refs priority', () => {
            for (const testCase of shouldBeRemoteHead) {
                it(testCase.ref, async () => {
                    const actual = await repo.resolveRef(testCase.ref);
                    const expected = testCase.oid;

                    assert.strictEqual(actual, expected);
                });
            }
        });
    });

    describe('expandRef()', () => {
        it('oid into oid', async () => {
            const oid = '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2';
            const actual = await repo.expandRef(oid);

            assert.strictEqual(actual, oid);
        });

        describe('all ref types', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.expandRef(testCase.ref);
                    const expected = testCase.fullFormRef;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('non-exists refs', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.expandRef(testCase.ref + 'n');
                    const expected = null;

                    assert.strictEqual(actual, expected);
                });
            }
        });
    });

    describe('isRefExists()', () => {
        describe('ref doesnt exist', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.isRefExists(testCase.ref + 'n');
                    const expected = false;

                    assert.strictEqual(actual, expected);
                });
            }
        });

        describe('ref is correct', () => {
            for (const testCase of refFixtures) {
                it(testCase.ref, async () => {
                    const actual = await repo.isRefExists(testCase.ref);
                    const expected = true;

                    assert.strictEqual(actual, expected);
                });
            }
        });
    });
});
