import fs from 'fs';
import { fileURLToPath } from 'url';
import { createGitReader } from '../../lib/index.js';

const gitdir = fileURLToPath(new URL('_git', import.meta.url));

const withCruft = await createGitReader(gitdir, { cruftPacks: 'include' });
const noCruft = await createGitReader(gitdir, { cruftPacks: 'exclude' });
const cruftOnly = await createGitReader(gitdir, { cruftPacks: 'only' });

const withCruftStat = await withCruft.stat();
const noCruftStat = await noCruft.stat();
const cruftOnlyStat = await cruftOnly.stat();

fs.writeFileSync(
    fileURLToPath(new URL('data.json', import.meta.url)),
    JSON.stringify(
        {
            totalPackedObjects: withCruftStat.objects.packed.objects.count,
            packedObjects: noCruftStat.objects.packed.objects.count,
            cruftObjects: cruftOnlyStat.objects.packed.objects.count
        },
        null,
        4
    )
);
