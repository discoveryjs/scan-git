import assert from 'assert';
import { fixtures, nullRepo } from './helpers/fixture.js';

describe('read-object', () => {
    let repo = nullRepo;
    before(async () => (repo = await fixtures.base.repo()));
    after(() => repo.dispose().then(() => (repo = nullRepo)));

    describe('readObjectByOid', () => {
        it('readObjectByOid()', async () => {
            const actual = await repo.readObjectByOid('3b08ed147f43899d1bc4db4a3a46d64445986a7a');

            assert.strictEqual(actual.type, 'blob');
        });
    });

    describe('readObjectHeaderByOid', () => {
        it('readObjectHeaderByOid()', async () => {
            const actual = await repo.readObjectHeaderByOid(
                '3b08ed147f43899d1bc4db4a3a46d64445986a7a'
            );

            assert.deepStrictEqual(actual, { type: 'blob', length: 6806 });
        });
    });

    describe('readObjectByHash', () => {
        it('readObjectByHash()', async () => {
            const actual = await repo.readObjectByHash(
                Buffer.from('3b08ed147f43899d1bc4db4a3a46d64445986a7a', 'hex')
            );

            assert.strictEqual(actual.type, 'blob');
        });
    });

    describe('readObjectHeaderByHash', () => {
        it('readObjectHeaderByHash()', async () => {
            const actual = await repo.readObjectHeaderByHash(
                Buffer.from('3b08ed147f43899d1bc4db4a3a46d64445986a7a', 'hex')
            );

            assert.deepStrictEqual(actual, { type: 'blob', length: 6806 });
        });
    });
});
