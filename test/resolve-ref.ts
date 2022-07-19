import assert from 'assert';
import { createGitReader } from '@discoveryjs/scan-git';

const repoPath = './.git';

describe('resolve-ref', () => {
    let repo;

    before(async () => {
        repo = await createGitReader(repoPath);
    });

    describe('listBranches()', () => {
        it('list local branches', async () => {
            const actual = await repo.listBranches();
            const expected = ['main'];

            assert.deepStrictEqual(actual, expected);
        });

        it('list remote branches', async () => {
            const actual = await repo.listBranches('origin');
            const expected = ['HEAD', 'main'];

            assert.deepStrictEqual(actual, expected);
        });

        it('list local branches with oids', async () => {
            const actual = await repo.listBranches(null, true);
            const expected = [{ name: 'main', oid: '8bb6e23769902199e39ab70f2441841712cbdd62' }];

            assert.deepStrictEqual(actual, expected);
        });

        it('list remote branches with oids', async () => {
            const actual = await repo.listBranches('origin', true);
            const expected = [
                { name: 'HEAD', oid: '0727d916d5a5479ca5bd64d81b9c3d0869e51d16' },
                { name: 'main', oid: '0727d916d5a5479ca5bd64d81b9c3d0869e51d16' }
            ];

            assert.deepStrictEqual(actual, expected);
        });
    });
});
