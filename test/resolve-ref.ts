import assert from 'assert';
import { fixtures } from './helpers/fixture.js';

describe('resolve-ref', () => {
    let repo;
    before(async () => (repo = await fixtures.base.repo()));

    describe('listBranches()', () => {
        it('list local branches', async () => {
            const actual = await repo.listBranches();
            const expected = ['main', 'onmain-branch', 'test'];

            assert.deepStrictEqual(actual, expected);
        });

        it('list remote branches', async () => {
            const actual = await repo.listBranches('origin');
            const expected = ['HEAD', 'main'];

            assert.deepStrictEqual(actual, expected);
        });

        it('list local branches with oids', async () => {
            const actual = await repo.listBranches(null, true);
            const expected = [
                { name: 'main', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'onmain-branch', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' },
                { name: 'test', oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6' }
            ];

            assert.deepStrictEqual(actual, expected);
        });

        it('list remote branches with oids', async () => {
            const actual = await repo.listBranches('origin', true);
            const expected = [
                { name: 'HEAD', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' },
                { name: 'main', oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2' }
            ];

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('listTags()', () => {
        it('list tags', async () => {
            const actual = await repo.listTags();
            const expected = ['onmain-tag', 'test-annotated-tag', 'test-tag'];

            assert.deepStrictEqual(actual, expected);
        });

        it('list tags with oids', async () => {
            const actual = await repo.listTags(true);
            const expected = [
                { name: 'onmain-tag', oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e' },
                { name: 'test-annotated-tag', oid: '56ea7a808e35df13e76fee92725a65a373a9835c' },
                { name: 'test-tag', oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6' }
            ];

            assert.deepStrictEqual(actual, expected);
        });
    });
});
