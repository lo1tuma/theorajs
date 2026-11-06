import path from 'path';
import test from 'ava';
import { readOggFile } from '../../../lib/files';
import { TransportStream } from '../../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../../src/lib/theora/decoder';
import { Frame } from '../../../../src/lib/theora/frame';
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

async function pictureFrame(): Promise<{ decoder: Decoder; frame: Frame }> {
    const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/320x240.ogg'));
    const [logicalStream] = new TransportStream(stream).findLogicalStreams();
    const decoder = new Decoder(logicalStream);
    const frame = decoder.nextFrame();
    if (!frame) {
        throw new Error('Missing first frame');
    }

    Object.assign(decoder, { width: 2, height: 2, xOffset: 0, yOffset: 0 });
    frame.recy.fill(235);
    frame.reccb.fill(128);
    frame.reccr.fill(128);
    frame.changedPixels = [[0, 0], [1, 0], [0, 1], [1, 1]];
    decoder.nextFrame = () => frame;
    return { decoder, frame };
}

test('renders chroma changes without reconstructed luma pixels', async (t) => {
    const { decoder, frame } = await pictureFrame();
    frame.recy.fill(76);
    const renderer = new RGBRenderer(decoder, { withAlphaChannel: true });
    const gray = new Uint8Array([69, 69, 69, 255]);
    const red = new Uint8Array([255, 0, 0, 255]);
    const first = renderer.nextRGBFrame();
    t.deepEqual(first, new Uint8Array([...gray, ...gray, ...gray, ...gray]));

    frame.reccb.fill(85);
    frame.reccr.fill(255);
    frame.changedPixels = [];

    t.deepEqual(renderer.nextRGBFrame(), new Uint8Array([...red, ...red, ...red, ...red]));
    t.deepEqual(first, new Uint8Array([...gray, ...gray, ...gray, ...gray]));
});

test('renders filtered pixels outside the reconstruction list', async (t) => {
    const { decoder, frame } = await pictureFrame();
    const renderer = new RGBRenderer(decoder, { withAlphaChannel: true });
    const white = new Uint8Array([255, 255, 255, 255]);
    const black = new Uint8Array([0, 0, 0, 255]);
    t.deepEqual(renderer.nextRGBFrame(), new Uint8Array([...white, ...white, ...white, ...white]));

    frame.recy[frame.rpyw + 1] = 16;
    frame.changedPixels = [[0, 0]];

    t.deepEqual(renderer.nextRGBFrame(), new Uint8Array([...white, ...black, ...white, ...white]));
});
