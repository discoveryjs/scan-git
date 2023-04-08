import assert from 'assert';
import { fixtures } from './helpers/fixture.js';

describe('list files', () => {
    let repo;
    before(async () => (repo = await fixtures.base.repo()));
    after(() => repo.dispose().then(() => (repo = null)));

    const { data } = fixtures.base;
    const headCommit = data.commits[0];
    const preHeadCommit = data.commits[1];

    const expectedHeadCommitFiles = data.filesLists[headCommit.oid];
    const expectedHeadCommitDelta = data.filesDelta[headCommit.oid];
    const expectedPreHeadCommitFiles = data.filesLists[preHeadCommit.oid];
    const expectedPreHeadCommitDelta = data.filesDelta[preHeadCommit.oid];

    describe('listFiles()', () => {
        it('without params', async () => {
            const actual = await repo.listFiles();

            assert.deepStrictEqual(actual.sort(), expectedHeadCommitFiles);
        });

        it('for HEAD ref', async () => {
            const actual = await repo.listFiles('HEAD');

            assert.deepStrictEqual(actual.sort(), expectedHeadCommitFiles);
        });

        it('for commit ref', async () => {
            const actual = await repo.listFiles(preHeadCommit.oid);

            assert.deepStrictEqual(actual.sort(), expectedPreHeadCommitFiles);
        });

        it('for tree ref', async () => {
            const actual = await repo.listFiles(preHeadCommit.tree);

            assert.deepStrictEqual(actual.sort(), expectedPreHeadCommitFiles);
        });
    });

    describe('deltaFiles()', () => {
        it('without params', async () => {
            const actual = await repo.deltaFiles();

            assert.deepStrictEqual(actual, expectedHeadCommitDelta);
        });

        it('for HEAD', async () => {
            const actual = await repo.deltaFiles('HEAD');

            assert.deepStrictEqual(actual, expectedHeadCommitDelta);
        });

        it('for commit ref', async () => {
            const actual = await repo.deltaFiles(preHeadCommit.oid);

            assert.deepStrictEqual(actual, expectedPreHeadCommitDelta);
        });

        it('for commits pair', async () => {
            const actual = await repo.deltaFiles(headCommit.oid, preHeadCommit.oid);

            assert.deepStrictEqual(actual, expectedHeadCommitDelta);
        });

        it('for tree ref', async () => {
            const actual = await repo.deltaFiles(preHeadCommit.tree);

            actual.add = actual.add.map((entry) => entry.path);

            assert.deepStrictEqual(actual, {
                add: expectedPreHeadCommitFiles,
                modify: [],
                remove: []
            });
        });

        it('for tree pair', async () => {
            const actual = await repo.deltaFiles(headCommit.tree, preHeadCommit.tree);

            assert.deepStrictEqual(actual, expectedHeadCommitDelta);
        });
    });

    describe('getPathEntry', () => {
        it('should return the correct TreeEntry for an existing file', async () => {
            const entry = await repo.getPathEntry('src/index.ts');

            assert.deepStrictEqual(entry, {
                isTree: false,
                path: 'src/index.ts',
                hash: Buffer.from('4ec5f4d51a1194290adf08917fe4d320432b67e1', 'hex')
            });
        });

        it('should return the correct TreeEntry for an existing file for a specified ref', async () => {
            const entry = await repo.getPathEntry(
                'src/index.ts',
                '900fced62c7d0bb8f68d5109d9c5fc9303c6a7ae'
            );

            assert.deepStrictEqual(entry, {
                isTree: false,
                path: 'src/index.ts',
                hash: Buffer.from('2dff36d07c5da36098f066b07dc8f72a925da88c', 'hex')
            });
        });

        it('should return the correct TreeEntry for an existing directory', async () => {
            const entry = await repo.getPathEntry('src');

            assert.deepStrictEqual(entry, {
                isTree: true,
                path: 'src',
                hash: Buffer.from('3f6fc011a10e9d4b65248128126a5f1d11294760', 'hex')
            });
        });

        it('should return the correct TreeEntry for an existing directory for a specified ref', async () => {
            const entry = await repo.getPathEntry(
                'src',
                '5a6c856773e30660623ed1398944fcb29b6371d8'
            );

            assert.deepStrictEqual(entry, {
                isTree: true,
                path: 'src',
                hash: Buffer.from('7cb15d51c15e67253ed70a9e464db86977635d63', 'hex')
            });
        });

        it('should return null for a non-existing file or directory', async () => {
            const entry = await repo.getPathEntry('non-exists');

            assert.strictEqual(entry, null);
        });

        it('should return null when the path points to a file inside a non-existing directory', async () => {
            const entry = await repo.getPathEntry('src/non-exists.ts');

            assert.strictEqual(entry, null);
        });
    });
});
