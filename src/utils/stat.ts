import { ObjectsStat, ObjectsTypeStat, ObjectsStatWithTypes } from '../types';

export function sumObjectsStat(stats: ObjectsStat[]) {
    const result: ObjectsStat = {
        count: 0,
        size: 0,
        packedSize: 0
    };

    for (const stat of stats) {
        result.count += stat.count;
        result.size += stat.size;
        result.packedSize += stat.packedSize;
    }

    return result;
}

export function objectsStatFromTypes(types: ObjectsTypeStat[]) {
    return {
        ...sumObjectsStat(types),
        types
    } as ObjectsStatWithTypes;
}
