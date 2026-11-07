import { promises as fs } from 'node:fs';
import path from 'node:path';
import { suite, test, type TestScope } from '@overkill-dev/test';
import type { Frame } from '../../../src/lib/theora/frame.ts';
import { readVideoFixture } from '../../lib/video-fixtures.ts';

type ReferencePlane = { readonly samples: Uint8Array; readonly width: number; readonly height: number; };

function topToBottom(plane: ReferencePlane): Buffer {
    const { samples, width, height } = plane;
    const actual = Buffer.alloc(width * height);
    for (let row = 0; row < height; row += 1) {
        const start = (height - row - 1) * width;
        actual.set(samples.subarray(start, start + width), row * width);
    }
    return actual;
}

function assertReferenceFrame(
    scope: TestScope,
    frame: Frame,
    expected: Buffer,
    frameCount: number
): number {
    let offset = 0;
    const planes = [
        { samples: frame.lumaPlane, width: 32, height: 32 },
        { samples: frame.blueChromaPlane, width: 16, height: 16 },
        { samples: frame.redChromaPlane, width: 16, height: 16 }
    ];
    for (const [ index, plane ] of planes.entries()) {
        const actual = topToBottom(plane);
        scope.assert.true(actual.equals(expected.subarray(offset, offset + actual.length)), {
            message: `Frame ${frameCount}, plane ${index}`
        });
        offset += actual.length;
    }

    return offset;
}

export const testNode = suite('independent reference', [
    test('reads the independent reference geometry', async function (scope) {
        const decoder = await readVideoFixture(path.resolve(import.meta.dirname, '../../fixtures/prediction.ogv'));
        scope.assert.equal(decoder.width, 32);
        scope.assert.equal(decoder.height, 32);
        scope.assert.equal(decoder.pixelFormat, 0);
        return scope.assert.collect();
    }),

    test('matches independent key and inter frame planes byte for byte', async function (scope) {
        const [ decoder, expected ] = await Promise.all([
            readVideoFixture(path.resolve(import.meta.dirname, '../../fixtures/prediction.ogv')),
            fs.readFile(path.resolve(import.meta.dirname, '../../fixtures/prediction.yuv'))
        ]);
        let offset = 0;
        let frameCount = 0;

        for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
            offset += assertReferenceFrame(scope, frame, expected.subarray(offset), frameCount);
            frameCount += 1;
        }

        scope.assert.equal(frameCount, 4);
        scope.assert.equal(offset, expected.length);
        return scope.assert.collect();
    })
]);
