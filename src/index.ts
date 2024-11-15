import { isGitDir, resolveGitDir } from './gitdir.js';
import { createReadObject } from './read-object.js';
import { createRefIndex } from './resolve-ref.js';
import { createLooseObjectIndex } from './loose-object-index.js';
import { createPackedObjectIndex } from './packed-object-index.js';
import { createFilesMethods } from './files-methods.js';
import { createCommitMethods } from './commits.js';
import { createStatMethod } from './stat.js';
import { promiseAllThreaded } from './utils/threads.js';
import { GitReaderOptions, NormalizedGitReaderOptions, CruftPackMode } from './types';

export * from './types.js';
export * from './parse-object.js';
export { isGitDir, resolveGitDir };

export async function createGitReader(gitdir: string, options?: Partial<GitReaderOptions>) {
    const startInitTime = Date.now();
    const normalizedOptions = normalizeOptions(options);
    const resolvedGitDir = await resolveGitDir(gitdir);
    const [refIndex, looseObjectIndex, packedObjectIndex] = await Promise.all([
        createRefIndex(resolvedGitDir, normalizedOptions),
        createLooseObjectIndex(resolvedGitDir, normalizedOptions),
        createPackedObjectIndex(resolvedGitDir, normalizedOptions)
    ]);
    const { readObjectHeaderByHash, readObjectByHash, readObjectHeaderByOid, readObjectByOid } =
        createReadObject(looseObjectIndex, packedObjectIndex);

    return {
        get gitdir() {
            return resolvedGitDir;
        },
        readObjectHeaderByHash,
        readObjectByHash,
        readObjectHeaderByOid,
        readObjectByOid,
        ...refIndex,
        ...createFilesMethods(readObjectByOid, readObjectByHash, refIndex.resolveRef),
        ...createCommitMethods(readObjectByOid, refIndex.resolveRef),
        async dispose() {
            await Promise.all([looseObjectIndex.dispose(), packedObjectIndex.dispose()]);
        },
        stat: createStatMethod(
            resolvedGitDir,
            { refIndex, looseObjectIndex, packedObjectIndex },
            normalizedOptions
        ),

        initTime: Date.now() - startInitTime
    };
}

function normalizeOptions(options?: Partial<GitReaderOptions>): NormalizedGitReaderOptions {
    const { cruftPacks = true, maxConcurrency } = options || {};
    const maxConcurrencyNormalized = Number.isFinite(maxConcurrency)
        ? (maxConcurrency as number)
        : 50;

    return {
        maxConcurrency: maxConcurrencyNormalized,
        performConcurrent: (queue, action) =>
            promiseAllThreaded(maxConcurrencyNormalized, queue, action),
        cruftPacks:
            typeof cruftPacks === 'string'
                ? validateCruftPackMode(cruftPacks)
                : cruftPacks // expands true/false aliases
                ? 'include'
                : 'exclude'
    };
}

function validateCruftPackMode(mode: string): CruftPackMode {
    const validModes: CruftPackMode[] = ['include', 'exclude', 'only'];
    if (!validModes.includes(mode as CruftPackMode)) {
        throw new Error(`"${mode}" is not a valid cruft pack mode`);
    }

    return mode as CruftPackMode;
}
