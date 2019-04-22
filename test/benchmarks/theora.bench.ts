import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import test from 'ava';
import { readOggFile, decodeAllFrames } from '../lib/files';

const mediumComplexOggFile = path.resolve(__dirname, '../fixtures/trailer_400p.ogg');
const cpuSpeed = os.cpus()[0].speed;

test('decoding many theora frames', async (t) => {
    const budget = 65000000 / cpuSpeed;
    const byteStream = await readOggFile(mediumComplexOggFile);

    const startTime = performance.now();
    decodeAllFrames(byteStream);
    const endTime = performance.now();
    const runTime = endTime - startTime;

    t.true(runTime < budget, `Performance budged exceeded: ${runTime}ms (limit: ${budget})`);
    t.log(`Performance budget ok: ${runTime}ms (limit: ${budget})`);
});
