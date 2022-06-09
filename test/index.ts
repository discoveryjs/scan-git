import assert from 'assert';
import { createGitReader } from '@discoveryjs/scan-git';

it('test', () => {
    assert(typeof createGitReader === 'function');
});
