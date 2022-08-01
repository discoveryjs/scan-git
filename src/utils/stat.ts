import { ObjectsStat, ObjectsTypeStat, ObjectsStatWithTypes, PackedObjectType } from '../types';

export function createObjectsStat(): ObjectsStat {
    return {
        count: 0,
        size: 0,
        unpackedSize: 0,
        unpackedRestoredSize: 0
    };
}

export function createObjectsTypeStat(type: PackedObjectType): ObjectsTypeStat {
    return {
        type,
        count: 0,
        size: 0,
        unpackedSize: 0,
        unpackedRestoredSize: 0
    };
}

export function sumObjectsStat(stats: ObjectsStat[]) {
    const result = createObjectsStat();

    for (const stat of stats) {
        result.count += stat.count;
        result.size += stat.size;
        result.unpackedSize += stat.unpackedSize;
        result.unpackedRestoredSize += stat.unpackedRestoredSize;
    }

    return result;
}

export function objectsStatFromTypes(types: ObjectsTypeStat[]) {
    return {
        ...sumObjectsStat(types),
        types
    } as ObjectsStatWithTypes;
}
