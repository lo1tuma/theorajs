import path from 'path';
import test from 'ava';
import { readOggFile } from '../../../lib/files';
import { TransportStream } from '../../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../../src/lib/theora/decoder';
import { RGBRenderer } from '../../../../src/lib/player/rgbRenderer';

for (const pixelFormat of [0, 2, 3]) {
    for (const withAlphaChannel of [false, true]) {
        test(`renders cropped borders for format ${pixelFormat}, alpha=${withAlphaChannel}`, async (t) => {
            const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/320x240.ogg'));
            const [logicalStream] = new TransportStream(stream).findLogicalStreams();
            const decoder = new Decoder(logicalStream);
            const frame = decoder.nextFrame();
            if (!frame) {
                t.fail('Missing first frame');
                return;
            }

            decoder.width = 2;
            decoder.height = 2;
            decoder.xOffset = 2;
            decoder.yOffset = 2;
            decoder.pixelFormat = pixelFormat;
            frame.recy.fill(235);
            frame.reccb.fill(128);
            frame.reccr.fill(128);
            frame.recy[2 * frame.rpyw + 2] = 16;
            frame.changedPixels = [];
            for (let row = 0; row < 6; row += 1) {
                for (let column = 0; column < 6; column += 1) {
                    frame.changedPixels.push([column, row]);
                }
            }

            decoder.nextFrame = () => frame;
            const renderer = new RGBRenderer(decoder, { withAlphaChannel });
            const white = withAlphaChannel ? [255, 255, 255, 255] : [255, 255, 255];
            const black = withAlphaChannel ? [0, 0, 0, 255] : [0, 0, 0];
            const expected = new Uint8Array([...white, ...white, ...black, ...white]);
            const first = renderer.nextRGBFrame();
            t.deepEqual(first, expected);

            frame.changedPixels = [];
            t.deepEqual(renderer.nextRGBFrame(), expected);
            if (first) {
                first.fill(42);
            }

            t.deepEqual(renderer.nextRGBFrame(), expected);

            decoder.nextFrame = () => false;
            t.false(renderer.nextRGBFrame());
        });
    }
}
