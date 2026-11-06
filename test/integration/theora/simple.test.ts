import path from 'node:path';
import test from 'ava';
import { decodeAllFramesForFile, readVideoFixture } from '../../lib/video-fixtures.ts';

const simpleOggFile = path.resolve(import.meta.dirname, '../../fixtures/320x240.ogg');

test('provides the correct meta information about the video stream', async function (t) {
    const decoder = await readVideoFixture(simpleOggFile);

    t.is(decoder.width, 320);
    t.is(decoder.height, 240);
    t.is(decoder.bitrate, 0);
    t.deepEqual(decoder.comments, {});
    t.is(decoder.vendor, 'Xiph.Org libTheora I 20040317 3 2 0');
    t.is(decoder.framerate, 30.000299);
    t.is(decoder.pixelFormat, 0);
    t.is(decoder.xOffset, 0);
    t.is(decoder.yOffset, 0);
});

test('decodes all frames without errors', async function (t) {
    const frameCount = await decodeAllFramesForFile(simpleOggFile);

    t.is(frameCount, 120);
});
