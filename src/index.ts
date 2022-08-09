import { createReadObject } from './read-object.js';
import { createRefIndex } from './resolve-ref.js';
import { createLooseObjectIndex } from './loose-object-index.js';
import { createPackedObjectIndex } from './packed-object-index.js';
import { createFilesMethods } from './files-list.js';
import { createCommitMethods } from './commits.js';
import { createStatMethod } from './stat.js';
import { GitReaderOptions, NormalizedGitReaderOptions, CruftPackMode } from './types';

export * from './types.js';
export * from './parse-object.js';

export async function createGitReader(gitdir: string, options?: GitReaderOptions) {
    const normalizedOptions = normalizeOptions(options);

    const startInitTime = Date.now();
    const [refIndex, looseObjectIndex, packedObjectIndex] = await Promise.all([
        createRefIndex(gitdir),
        createLooseObjectIndex(gitdir),
        createPackedObjectIndex(gitdir, normalizedOptions)
    ]);
    const { readObjectHeaderByHash, readObjectByHash, readObjectHeaderByOid, readObjectByOid } =
        createReadObject(looseObjectIndex, packedObjectIndex);

    return {
        readObjectHeaderByHash,
        readObjectByHash,
        readObjectHeaderByOid,
        readObjectByOid,
        ...refIndex,
        ...createFilesMethods(readObjectByOid, readObjectByHash, refIndex.resolveRef),
        ...createCommitMethods(readObjectByOid, refIndex.resolveRef),
        stat: createStatMethod({ gitdir, refIndex, looseObjectIndex, packedObjectIndex }),

        initTime: Date.now() - startInitTime
    };
}

function normalizeOptions(options?: GitReaderOptions): NormalizedGitReaderOptions {
    if (!options || options.cruftPacks === undefined) {
        return { cruftPacks: 'include' };
    }

    return {
        cruftPacks:
            typeof options.cruftPacks === 'string'
                ? validateCruftPackMode(options.cruftPacks)
                : options.cruftPacks // expands true/false aliases
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
