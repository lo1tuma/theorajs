import path from 'path';
import test from 'ava';
import { TransportStream } from '../../../src/ogg/transportStream';
import { Decoder } from '../../../src/theora/decoder';
import { readOggFile, decodeAllFramesForFile } from '../../lib/files';

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
