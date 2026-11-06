import path from 'node:path';
import test, { type ExecutionContext } from 'ava';
import pixelmatch from 'pixelmatch';

import { PNG } from 'pngjs';
import type { Decoder } from '../../../src/lib/theora/decoder.ts';
import { frameToPng, readPng, savePngDiff } from '../../lib/image-artifacts.ts';
import {
    decodeAllFramesForFile,
    forAllRGBAFrames,
    readOggFile,
    readVideoFixture
} from '../../lib/video-fixtures.ts';

const mediumComplexOggFile = path.resolve(import.meta.dirname, '../../fixtures/trailer_400p.ogg');

test('provides the correct meta information about the video stream', async function (t) {
    const decoder = await readVideoFixture(mediumComplexOggFile);

    t.is(decoder.width, 720);
    t.is(decoder.height, 400);
    t.is(decoder.bitrate, 0);
    t.deepEqual(decoder.comments, {
        encoder: 'ffmpeg2theora 0.19'
    });
    t.is(decoder.vendor, 'Xiph.Org libTheora I 20060526 3 2 0');
    t.is(decoder.framerate, 25);
    t.is(decoder.pixelFormat, 0);
    t.is(decoder.xOffset, 0);
    t.is(decoder.yOffset, 0);
});

test('decodes all frames without errors', async function (t) {
    const frameCount = await decodeAllFramesForFile(mediumComplexOggFile);

    t.is(frameCount, 813);
});

async function saveMismatch(t: ExecutionContext, expected: PNG, actual: PNG, frameIndex: number): Promise<void> {
    const { width, height } = expected;
    const diff = new PNG({ width, height });
    pixelmatch(expected.data, actual.data, diff.data, width, height, { threshold: 0, includeAA: true });
    const diffPath = await savePngDiff(`./trailer_400p_frame_${frameIndex}_diff.png`, diff);
    const expectedPath = await savePngDiff(`./trailer_400p_frame_${frameIndex}_expected.png`, expected);
    const actualPath = await savePngDiff(`./trailer_400p_frame_${frameIndex}_actual.png`, actual);
    t.log(`Mismatched frame ${frameIndex}. Expected: ${expectedPath}. Actual: ${actualPath}. Diff: ${diffPath}.`);
}

test('matches independently generated RGBA references exactly', async function (t) {
    const byteStream = await readOggFile(mediumComplexOggFile);

    t.plan(813);
    let savedDiffs = 0;

    await forAllRGBAFrames(byteStream, async function (frame: Uint8Array, decoder: Decoder, frameIndex: number) {
        const actualPng = frameToPng(frame, decoder);
        const expectedPng = await readPng(`./test/reference-pictures/trailer_400p/frame_${frameIndex}.png`);
        const { width, height } = expectedPng;
        const sameDimensions = width === decoder.width && height === decoder.height;
        const matches = sameDimensions && Buffer.from(frame).equals(expectedPng.data);

        if (!matches && sameDimensions && savedDiffs < 3) {
            savedDiffs += 1;
            await saveMismatch(t, expectedPng, actualPng, frameIndex);
        }

        t.true(matches, `Frame ${frameIndex}: expected ${width}x${height}, actual ${decoder.width}x${decoder.height}`);
    });
});
