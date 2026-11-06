import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import { decodeAllFrames, readOggFile } from '../lib/video-fixtures.ts';

const mediumComplexOggFile = path.resolve(import.meta.dirname, '../fixtures/trailer_400p.ogg');
const cpuSpeed = os.cpus().at(0)?.speed ?? 0;
if (cpuSpeed <= 0) {
    throw new Error('CPU frequency is unavailable.');
}

test('decoding many theora frames', async function (t) {
    const budget = 75_000_000 / cpuSpeed;
    const byteStream = await readOggFile(mediumComplexOggFile);

    const startTime = performance.now();
    decodeAllFrames(byteStream);
    const endTime = performance.now();
    const runTime = endTime - startTime;

    t.true(runTime < budget, `Performance budged exceeded: ${runTime}ms (limit: ${budget})`);

    if (runTime < budget) {
        t.log(`Performance budget ok: ${runTime}ms (limit: ${budget})`);
    }
});
