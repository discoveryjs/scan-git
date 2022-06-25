import { join as pathJoin } from 'path';
import { promises as fsPromises } from 'fs';
import { PackContent, readPackFile } from './packed-pack.js';
import { InternalGitObjectContent, InternalGitObjectHeader } from './types.js';

export async function createPackedObjectIndex(gitdir: string) {
    function readObjectHeaderByHash(
        hash: Buffer,
        exclude: PackContent | null = null
    ): Promise<InternalGitObjectHeader | null> | null {
        for (const packFile of packFiles) {
            if (packFile !== exclude) {
                const index = packFile.getObjectIndex(hash);

                if (index !== -1) {
                    return packFile.readObjectHeaderByIndex(index);
                }
            }
        }

        return null;
    }

    function readObjectByHash(
        hash: Buffer,
        exclude: PackContent | null = null
    ): Promise<InternalGitObjectContent | null> | null {
        for (const packFile of packFiles) {
            if (packFile !== exclude) {
                const idnex = packFile.getObjectIndex(hash);

                if (idnex !== -1) {
                    return packFile.readObjectByIndex(idnex);
                }
            }
        }

        return null;
    }

    const packdir = pathJoin(gitdir, 'objects/pack');
    const packFilenames = (await fsPromises.readdir(packdir))
        .filter((filename) => filename.endsWith('.pack'))
        .map((filename) => `${packdir}/${filename}`);

    const packFiles = await Promise.all(
        packFilenames.map((filename) =>
            readPackFile(filename, readObjectHeaderByHash, readObjectByHash)
        )
    );

    return {
        readObjectHeaderByHash,
        readObjectHeaderByOid(oid: string) {
            return readObjectHeaderByHash(Buffer.from(oid, 'hex'));
        },
        readObjectByHash,
        readObjectByOid(oid: string) {
            return readObjectByHash(Buffer.from(oid, 'hex'));
        }
    };
}
