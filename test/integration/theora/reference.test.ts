import { promises as fs } from 'node:fs';
import path from 'node:path';
import { suite, test, type TestScope } from '@overkill-dev/test';
import type { Decoder } from '../../../src/lib/theora/decoder.ts';
import type { Frame } from '../../../src/lib/theora/frame.ts';
import { readVideoFixture } from '../../lib/video-fixtures.ts';

type ReferencePlane = { readonly samples: Uint8Array; readonly width: number; readonly height: number; };

const references = [
    {
        name: 'prediction',
        width: 32,
        height: 32,
        chromaWidth: 16,
        chromaHeight: 16,
        pixelFormat: 0,
        frames: 4,
        bytes: 6144
    },
    {
        name: 'prediction-422',
        width: 96,
        height: 64,
        chromaWidth: 48,
        chromaHeight: 64,
        pixelFormat: 2,
        frames: 8,
        bytes: 98_304
    }
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

type Reference = Readonly<typeof references[number]>;

function assertDecoderGeometry(scope: TestScope, decoder: Decoder, reference: Reference): void {
    scope.assert.equal(decoder.width, reference.width);
    scope.assert.equal(decoder.height, reference.height);
    scope.assert.equal(decoder.pixelFormat, reference.pixelFormat);
    scope.assert.equal(decoder.xOffset, 0);
    scope.assert.equal(decoder.yOffset, 0);
}

function assertFrameGeometry(scope: TestScope, frame: Frame, reference: Reference): void {
    scope.assert.equal(frame.lumaWidth, reference.width);
    scope.assert.equal(frame.lumaHeight, reference.height);
    scope.assert.equal(frame.chromaWidth, reference.chromaWidth);
    scope.assert.equal(frame.chromaHeight, reference.chromaHeight);
}

type ReferenceComparison = { readonly expected: Buffer; readonly frameCount: number; };

function assertReferenceFrame(
    scope: TestScope,
    frame: Frame,
    reference: Reference,
    comparison: ReferenceComparison
): number {
    assertFrameGeometry(scope, frame, reference);
    scope.assert.equal(frame.frameType, comparison.frameCount === 0 ? 0 : 1);
    let offset = 0;
    const planes = [
        { samples: frame.lumaPlane, width: frame.lumaWidth, height: frame.lumaHeight },
        { samples: frame.blueChromaPlane, width: frame.chromaWidth, height: frame.chromaHeight },
        { samples: frame.redChromaPlane, width: frame.chromaWidth, height: frame.chromaHeight }
    ];
    for (const [ index, plane ] of planes.entries()) {
        scope.assert.equal(plane.samples.length, plane.width * plane.height);
        const actual = topToBottom(plane);
        scope.assert.true(actual.equals(comparison.expected.subarray(offset, offset + actual.length)), {
            message: `Frame ${comparison.frameCount}, plane ${index}`
        });
        offset += actual.length;
    }
    return offset;
}

export const testNode = suite(
    'independent reference',
    references.flatMap(function (reference) {
        return [
            test(`reads ${reference.name} geometry`, async function (scope) {
                const decoder = await readVideoFixture(
                    path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.ogv`)
                );
                assertDecoderGeometry(scope, decoder, reference);
                const expected = await fs.readFile(
                    path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.yuv`)
                );
                scope.assert.equal(expected.length, reference.bytes);
                return scope.assert.collect();
            }),
            test(`matches ${reference.name} key/inter planes byte for byte`, async function (scope) {
                const [ decoder, expected ] = await Promise.all([
                    readVideoFixture(path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.ogv`)),
                    fs.readFile(path.resolve(import.meta.dirname, `../../fixtures/${reference.name}.yuv`))
                ]);
                let offset = 0;
                let frameCount = 0;
                for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
                    offset += assertReferenceFrame(scope, frame, reference, {
                        expected: expected.subarray(offset),
                        frameCount
                    });
                    frameCount += 1;
                }
                scope.assert.equal(frameCount, reference.frames);
                scope.assert.equal(offset, expected.length);
                return scope.assert.collect();
            })
        ];
    })
);
