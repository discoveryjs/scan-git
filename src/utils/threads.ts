/**
 * Run async tasks in queue with a maximum number of threads.
 * Works like Promise.all, but with a maximum number of threads.
 *   - The order of the results is guaranteed to be the same as the order of the input queue.
 *   - If any task fails, the whole queue is rejected.
 *   - If the queue is empty, the result is an empty array.
 *   - If the queue has only one task, the result is an array with one element.
 *
 * @example
 *   // Before
 *   const packFiles = await Promise.all(
 *     packFilenames.map((filename) =>
 *       readPackFile(gitdir, `${PACKDIR}/${filename}`, readObjectHeaderByHash, readObjectByHash)
 *     )
 *   );
 *
 *   // After
 *   const packFiles = await promiseAllThreaded(50, packFilenames, async (filename) =>
 *     readPackFile(gitdir, `${PACKDIR}/${filename}`, readObjectHeaderByHash, readObjectByHash)
 *   );
 */
export async function promiseAllThreaded<T, R>(
    maxThreadCount: number,
    queue: T[],
    asyncFn: (task: T, taskIdx: number) => Promise<R>
): Promise<R[]> {
    const result = Array(queue.length);
    let taskProcessed = 0;
    let queueSnapshot = [...queue];
    const thread = async () => {
        while (taskProcessed < queueSnapshot.length) {
            const taskIdx = taskProcessed++;
            const task = queueSnapshot[taskIdx];
            result[taskIdx] = await asyncFn(task, taskIdx);
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(maxThreadCount, queueSnapshot.length) }, () => thread())
    ).catch((err) => {
        // remove all pending tasks
        queueSnapshot = [];
        throw err;
    });

    return result;
}
