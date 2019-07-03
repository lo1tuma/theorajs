import path from 'path';
import test from 'ava';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { TransportStream } from '../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../src/lib/theora/decoder';
import {
    savePngDiff,
    readOggFile,
    decodeAllFramesForFile,
    frameToPng,
    readPng,
    forAllRGBAFrames
} from '../../lib/files';

const mediumComplexOggFile = path.resolve(__dirname, '../../fixtures/trailer_400p.ogg');

test('provides the correct meta information about the video stream', async (t) => {
    const byteStream = await readOggFile(mediumComplexOggFile);
    const transportStream = new TransportStream(byteStream);

    const [videoStream] = transportStream.findLogicalStreams();

    const decoder = new Decoder(videoStream);

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

test('decodes all frames without errors', async (t) => {
    const frameCount = await decodeAllFramesForFile(mediumComplexOggFile);

    t.is(frameCount, 813);
});

test('matches the reference pictures exactly', async (t) => {
    const byteStream = await readOggFile(mediumComplexOggFile);

    t.plan(813);

    await forAllRGBAFrames(byteStream, async (frame: Uint8Array, decoder: Decoder, frameIndex: number) => {
        const actualPng = frameToPng(frame, decoder);
        const expectedPng = await readPng(`./test/reference-pictures/trailer_400p/frame_${frameIndex}.png`);
        const { width, height } = expectedPng;
        const diff = new PNG({ width, height });

        const numberOfMismatchedPixels = pixelmatch(expectedPng.data, actualPng.data, diff.data, width, height, {
            threshold: 0.0
        });

        if (numberOfMismatchedPixels > 0) {
            const diffPath = await savePngDiff(`./trailer_400p_frame_${frameIndex}_diff.png`, diff);
            const actualPath = await savePngDiff(`./trailer_400p_frame_${frameIndex}_actual.png`, actualPng);
            t.log(`Mismatched frame number ${frameIndex}. Diff file has been saved at ${diffPath}.`);
        }

        t.is(numberOfMismatchedPixels, 0);
    });
});
