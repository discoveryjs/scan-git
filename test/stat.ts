import assert from 'assert';
import { fixtures } from './helpers/fixture.js';

describe('stat', () => {
    let repo;
    before(async () => (repo = await fixtures.base.repo));

    const { data } = fixtures.base;

    describe('stat()', () => {
        it('without params', async () => {
            const actual = await repo.stat();

            assert.deepStrictEqual(actual, data.stat);
        });
    });
});
