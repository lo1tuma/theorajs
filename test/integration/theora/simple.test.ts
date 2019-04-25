import path from 'path';
import test from 'ava';
import { TransportStream } from '../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../src/lib/theora/decoder';
import { readOggFile, decodeAllFramesForFile } from '../../lib/files';

const simpleOggFile = path.resolve(__dirname, '../../fixtures/320x240.ogg');

test('provides the correct meta information about the video stream', async (t) => {
    const byteStream = await readOggFile(simpleOggFile);
    const transportStream = new TransportStream(byteStream);

    const [videoStream] = transportStream.findLogicalStreams();

    const decoder = new Decoder(videoStream);

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

test('decodes all frames without errors', async (t) => {
    const frameCount = await decodeAllFramesForFile(simpleOggFile);

    t.is(frameCount, 120);
});
