import path from 'node:path';
import test from 'ava';
import type { LogicalStream } from '../../../../src/lib/ogg/logicalStream.ts';
import type { Frame } from '../../../../src/lib/theora/frame.ts';
import { createPacket } from '../../../../src/lib/ogg/packet.ts';
import { createCoefficientStorage } from '../../../../src/lib/theora/coefficient-storage.ts';
import { createDecoder } from '../../../../src/lib/theora/decoder.ts';
import { invertDirectPrediction } from '../../../../src/lib/theora/direct-prediction.ts';
import { readOggFile, requireTheoraStream } from '../../../lib/video-fixtures.ts';

for (const initial of [ 32_760, -32_760 ]) {
    test(`DC prediction preserves signed overflow from ${initial}`, function (t) {
        const delta = initial > 0 ? 100 : -100;
        const { coefficients } = createCoefficientStorage(3);
        coefficients.setDirect(0, initial);
        coefficients.setDirect(1, delta);
        coefficients.setDirect(2, delta);
        invertDirectPrediction(coefficients, {
            header: { lumaBlockCount: 3, chromaBlockCount: 0, lumaBlockWidth: 3, chromaBlockWidth: 0 },
            mappings: {
                rasterToCodedOrder(index) {
                    return index;
                },
                codedToRasterOrder(index) {
                    return index;
                },
                blockToMacroblock() {
                    return 0;
                },
                blockToSuperblock() {
                    return 0;
                },
                macroblockToBlocks() {
                    return [ 0, 1, 2 ];
                },
                superBlockSize() {
                    return 3;
                }
            },
            modes: [ 1 ],
            flags: [ 1, 1, 1 ]
        });
        t.is(coefficients.value(0, 0), initial);
        t.is(coefficients.value(1, 0), initial > 0 ? -32_676 : 32_676);
        t.is(coefficients.value(2, 0), initial > 0 ? -32_576 : 32_576);
    });
}

test('decodes coefficients above the signed 8-bit range without wrapping', async function (t) {
    const stream = await readOggFile(path.resolve(import.meta.dirname, '../../../fixtures/coefficient-range.ogv'));
    const logicalStream = requireTheoraStream(stream);
    const decoder = createDecoder(logicalStream);
    let count = 0;

    for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
        t.deepEqual(
            frame.lumaPlane,
            Uint8Array.from({ length: 32 * 32 }, function () {
                return 235;
            })
        );
        t.deepEqual(
            frame.blueChromaPlane,
            Uint8Array.from({ length: 16 * 16 }, function () {
                return 128;
            })
        );
        t.deepEqual(
            frame.redChromaPlane,
            Uint8Array.from({ length: 16 * 16 }, function () {
                return 128;
            })
        );
        count += 1;
    }

    t.is(count, 1);
});

function repeatedFrames(logicalStream: LogicalStream): readonly [Frame, Frame] {
    let repeatPrevious = false;
    const decoder = createDecoder({
        ...logicalStream,
        nextPacket() {
            return repeatPrevious ? createPacket() : logicalStream.nextPacket();
        }
    });
    const first = decoder.nextFrame();
    repeatPrevious = true;
    const repeated = decoder.nextFrame();
    if (first === false || repeated === false) {
        throw new Error('Missing decoded frame');
    }
    return [ first, repeated ];
}

test('an empty frame packet repeats the previous frame', async function (t) {
    const stream = await readOggFile(path.resolve(import.meta.dirname, '../../../fixtures/coefficient-range.ogv'));
    const logicalStream = requireTheoraStream(stream);
    const [ first, repeated ] = repeatedFrames(logicalStream);

    t.deepEqual(repeated.lumaPlane, first.lumaPlane);
    t.deepEqual(repeated.blueChromaPlane, first.blueChromaPlane);
    t.deepEqual(repeated.redChromaPlane, first.redChromaPlane);
    t.deepEqual(repeated.changedPixels, []);
});
