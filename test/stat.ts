import assert from 'assert';
import { fixtures } from './helpers/fixture.js';

describe('stat', () => {
    describe('stat()', () => {
        it('without params', async () => {
            const repo = await fixtures.base.repo();
            const actual = await repo.stat();

            assert.deepStrictEqual(actual, fixtures.base.data.stat);
        });

        it('counts objects in cruft packs', async () => {
            const repo = await fixtures.cruft.repo({ cruftPacks: 'only' });
            const stat = await repo.stat();

            assert.deepStrictEqual(
                stat.objects.packed.objects.count,
                fixtures.cruft.data.cruftObjects
            );
        });

        it('counts objects in regular packs only', async () => {
            const repo = await fixtures.cruft.repo({ cruftPacks: 'exclude' });
            const stat = await repo.stat();

            assert.deepStrictEqual(
                stat.objects.packed.objects.count,
                fixtures.cruft.data.packedObjects
            );
        });

        it('counts all packed objects', async () => {
            const repo = await fixtures.cruft.repo({ cruftPacks: 'include' });
            const stat = await repo.stat();

            assert.deepStrictEqual(
                stat.objects.packed.objects.count,
                fixtures.cruft.data.totalPackedObjects
            );
        });

        it('counts all packed objects, when cruftPacks option is not specified', async () => {
            const repo = await fixtures.cruft.repo();
            const stat = await repo.stat();

            assert.deepStrictEqual(
                stat.objects.packed.objects.count,
                fixtures.cruft.data.totalPackedObjects
            );
        });
    });
});
