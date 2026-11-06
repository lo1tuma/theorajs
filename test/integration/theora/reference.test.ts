import { promises as fs } from 'node:fs';
import path from 'node:path';
import test, { type ExecutionContext } from 'ava';
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

function assertReferenceFrame(t: ExecutionContext, frame: Frame, expected: Buffer, frameCount: number): number {
    let offset = 0;
    const planes = [
        { samples: frame.lumaPlane, width: 32, height: 32 },
        { samples: frame.blueChromaPlane, width: 16, height: 16 },
        { samples: frame.redChromaPlane, width: 16, height: 16 }
    ];
    for (const [ index, plane ] of planes.entries()) {
        const actual = topToBottom(plane);
        t.true(actual.equals(expected.subarray(offset, offset + actual.length)), `Frame ${frameCount}, plane ${index}`);
        offset += actual.length;
    }

    return offset;
}

test('reads the independent reference geometry', async function (t) {
    const decoder = await readVideoFixture(path.resolve(import.meta.dirname, '../../fixtures/prediction.ogv'));
    t.is(decoder.width, 32);
    t.is(decoder.height, 32);
    t.is(decoder.pixelFormat, 0);
});

test('matches independent key and inter frame planes byte for byte', async function (t) {
    const fixture = path.resolve(import.meta.dirname, '../../fixtures/prediction.ogv');
    const expected = await fs.readFile(path.resolve(import.meta.dirname, '../../fixtures/prediction.yuv'));
    const decoder = await readVideoFixture(fixture);
    let offset = 0;
    let frameCount = 0;

    for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
        offset += assertReferenceFrame(t, frame, expected.subarray(offset), frameCount);
        frameCount += 1;
    }

    t.is(frameCount, 4);
    t.is(offset, expected.length);
});
