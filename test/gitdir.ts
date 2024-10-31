import assert from 'assert';
import path from 'path';
import { isGitDir, resolveGitDir } from '@discoveryjs/scan-git';

const cwd = process.cwd();
const gitdir = path.join(cwd, '.git');

describe('Git Directory Utilities', () => {
    describe('isGitDir()', () => {
        it('should return false for non-Git directory', async () => {
            const actual = await isGitDir(cwd);
            assert.strictEqual(actual, false);
        });

        it('should return true for valid Git directory', async () => {
            const actual = await isGitDir(gitdir);
            assert.strictEqual(actual, true);
        });
    });

    describe('resolveGitDir()', () => {
        describe('absolute paths', () => {
            it('should resolve current working directory to Git directory', async () => {
                const actual = await resolveGitDir(cwd);
                assert.strictEqual(actual, gitdir);
            });

            it('should resolve .git directory path to itself', async () => {
                const actual = await resolveGitDir(gitdir);
                assert.strictEqual(actual, gitdir);
            });
        });

        describe('relative paths', () => {
            it('should resolve empty path to Git directory', async () => {
                const actual = await resolveGitDir('');
                assert.strictEqual(actual, gitdir);
            });

            it('should resolve .git relative path to Git directory', async () => {
                const actual = await resolveGitDir('.git');
                assert.strictEqual(actual, gitdir);
            });
        });

        it('should throws for non existing paths', () => {
            const testdir = path.resolve(cwd, 'non-exists');

            return assert.rejects(
                () => resolveGitDir(testdir),
                (e: Error) => e.message.endsWith(`No such directory "${testdir}"`)
            );
        });

        it('should throws for non directory paths', () => {
            const testpath = path.resolve(cwd, 'package.json');

            return assert.rejects(
                () => resolveGitDir(testpath),
                (e: Error) => e.message.endsWith(`Not a directory "${testpath}"`)
            );
        });
    });
});
