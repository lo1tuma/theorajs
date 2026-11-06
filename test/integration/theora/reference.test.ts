import path from 'path';
import { promises as fs } from 'fs';
import test from 'ava';
import { readOggFile } from '../../lib/files';
import { TransportStream } from '../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../src/lib/theora/decoder';

test('matches independent key and inter frame planes byte for byte', async (t) => {
    const fixture = path.resolve(__dirname, '../../fixtures/prediction.ogv');
    const expected = await fs.readFile(path.resolve(__dirname, '../../fixtures/prediction.yuv'));
    const stream = await readOggFile(fixture);
    const [logicalStream] = new TransportStream(stream).findLogicalStreams();
    const decoder = new Decoder(logicalStream);
    let offset = 0;
    let frameCount = 0;

    t.is(decoder.width, 32);
    t.is(decoder.height, 32);
    t.is(decoder.pixelFormat, 0);

    for (let frame = decoder.nextFrame(); frame; frame = decoder.nextFrame()) {
        const planes = [frame.recy, frame.reccb, frame.reccr];
        const widths = [32, 16, 16];
        const heights = [32, 16, 16];
        for (let index = 0; index < planes.length; index += 1) {
            const width = widths[index];
            const height = heights[index];
            const actual = Buffer.alloc(width * height);
            for (let row = 0; row < height; row += 1) {
                const start = (height - row - 1) * width;
                actual.set(planes[index].subarray(start, start + width), row * width);
            }

            t.true(
                actual.equals(expected.subarray(offset, offset + actual.length)),
                `Frame ${frameCount}, plane ${index}`
            );
            offset += actual.length;
        }

        frameCount += 1;
    }

    t.is(frameCount, 4);
    t.is(offset, expected.length);
});
