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
});
