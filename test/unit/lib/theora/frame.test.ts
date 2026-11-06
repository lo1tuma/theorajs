import path from 'path';
import test from 'ava';
import { Packet } from '../../../../src/lib/ogg/packet';
import { readOggFile } from '../../../lib/files';
import { TransportStream } from '../../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../../src/lib/theora/decoder';
import { Header } from '../../../../src/lib/theora/header';

for (const initial of [32760, -32760]) {
    test(`DC prediction preserves signed overflow from ${initial}`, async (t) => {
        const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/320x240.ogg'));
        const [logicalStream] = new TransportStream(stream).findLogicalStreams();
        const frame = new Decoder(logicalStream).nextFrame();
        if (!frame) {
            t.fail('Missing first frame');
            return;
        }

        const delta = initial > 0 ? 100 : -100;
        const coefficients = [new Int16Array([initial]), new Int16Array([delta]), new Int16Array([delta])];
        Object.assign(frame, {
            header: Object.assign(new Header(), { nlbs: 3, ncbs: 0, flbw: 3 }),
            tables: { rasterToCodedOrder: [0, 1, 2], codedToRasterOrder: [0, 1, 2], biToMbi: [0, 0, 0] },
            colorPlaneOffsets: [0, 3, 3],
            mbmodes: [1],
            bcoded: [1, 1, 1],
            coeffs: coefficients
        });
        frame.invertDCPrediction();

        t.is(coefficients[0][0], initial);
        t.is(coefficients[1][0], initial > 0 ? -32676 : 32676);
        t.is(coefficients[2][0], initial > 0 ? -32576 : 32576);
    });
}

test('decodes coefficients above the signed 8-bit range without wrapping', async (t) => {
    const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/coefficient-range.ogv'));
    const [logicalStream] = new TransportStream(stream).findLogicalStreams();
    const decoder = new Decoder(logicalStream);
    let count = 0;

    for (let frame = decoder.nextFrame(); frame; frame = decoder.nextFrame()) {
        t.deepEqual(frame.recy, new Uint8Array(32 * 32).fill(235));
        t.deepEqual(frame.reccb, new Uint8Array(16 * 16).fill(128));
        t.deepEqual(frame.reccr, new Uint8Array(16 * 16).fill(128));
        count += 1;
    }

    t.is(count, 1);
});

test('an empty frame packet repeats the previous frame', async (t) => {
    const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/coefficient-range.ogv'));
    const [logicalStream] = new TransportStream(stream).findLogicalStreams();
    const decoder = new Decoder(logicalStream);
    const first = decoder.nextFrame();
    logicalStream.nextPacket = () => new Packet();
    const repeated = decoder.nextFrame();

    if (!first || !repeated) {
        t.fail('Missing decoded frame');
        return;
    }

    t.deepEqual(repeated.recy, first.recy);
    t.deepEqual(repeated.reccb, first.reccb);
    t.deepEqual(repeated.reccr, first.reccr);
    t.deepEqual(repeated.changedPixels, []);
});
