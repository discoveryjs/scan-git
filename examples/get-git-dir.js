import { resolve } from 'path';

export const gitDir = resolve(process.argv[2] || '.git');
