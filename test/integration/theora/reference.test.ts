import { promises as fs } from 'node:fs';
import path from 'node:path';
import { suite, test, type TestScope } from '@overkill-dev/test';
import type { Frame } from '../../../src/lib/theora/frame.ts';
import { readVideoFixture } from '../../lib/video-fixtures.ts';

type ReferencePlane = { readonly samples: Uint8Array; readonly width: number; readonly height: number; };

const references = [
    { name: 'prediction', width: 32, height: 32, chromaWidth: 16, chromaHeight: 16, pixelFormat: 0, frames: 4 },
    { name: 'prediction-422', width: 96, height: 64, chromaWidth: 48, chromaHeight: 64, pixelFormat: 2, frames: 8 }
];

function topToBottom(plane: ReferencePlane): Buffer {
    const { samples, width, height } = plane;
    const actual = Buffer.alloc(width * height);
    for (let row = 0; row < height; row += 1) {
        const start = (height - row - 1) * width;
        actual.set(samples.subarray(start, start + width), row * width);
    }
    return actual;
}

function assertReferenceFrame(scope: TestScope, frame: Frame, expected: Buffer, frameCount: number): number {
    let offset = 0;
    const planes = [
        { samples: frame.lumaPlane, width: frame.lumaWidth, height: frame.lumaHeight },
        { samples: frame.blueChromaPlane, width: frame.chromaWidth, height: frame.chromaHeight },
        { samples: frame.redChromaPlane, width: frame.chromaWidth, height: frame.chromaHeight }
    ];
    for (const [ index, plane ] of planes.entries()) {
        scope.assert.equal(plane.samples.length, plane.width * plane.height);
        const actual = topToBottom(plane);
        scope.assert.true(actual.equals(expected.subarray(offset, offset + actual.length)), {
            message: `Frame ${frameCount}, plane ${index}`
        });
        offset += actual.length;
    }
    return offset;
}

export const testNode = suite('independent reference', references.map(function (reference) {
    return test(`matches ${reference.name} geometry and key/inter planes byte for byte`, async function (scope) {
        const [ decoder, expected ] = await Promise.all([
            readVideoFixture(path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.ogv`)),
            fs.readFile(path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.yuv`))
        ]);
        scope.assert.equal(decoder.width, reference.width);
        scope.assert.equal(decoder.height, reference.height);
        scope.assert.equal(decoder.pixelFormat, reference.pixelFormat);
        scope.assert.equal(decoder.xOffset, 0);
        scope.assert.equal(decoder.yOffset, 0);
        scope.assert.equal(expected.length, reference.frames *
            (reference.width * reference.height + 2 * reference.chromaWidth * reference.chromaHeight));
        let offset = 0;
        let frameCount = 0;
        const frameTypes = new Set<number>();
        for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
            scope.assert.equal(frame.lumaWidth, reference.width);
            scope.assert.equal(frame.lumaHeight, reference.height);
            scope.assert.equal(frame.chromaWidth, reference.chromaWidth);
            scope.assert.equal(frame.chromaHeight, reference.chromaHeight);
            frameTypes.add(frame.frameType);
            offset += assertReferenceFrame(scope, frame, expected.subarray(offset), frameCount);
            frameCount += 1;
        }
        scope.assert.true(frameTypes.has(0));
        scope.assert.true(frameTypes.has(1));
        scope.assert.equal(frameCount, reference.frames);
        scope.assert.equal(offset, expected.length);
        return scope.assert.collect();
    });
}));
