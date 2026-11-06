import test, { type ExecutionContext } from 'ava';
import { createPacket } from '../../../../src/lib/ogg/packet.ts';
import { convertLumaChromaToColor } from '../../../../src/lib/player/color-conversion.ts';
import { createBitstream } from '../../../../src/lib/theora/packet-bits.ts';

function convertMacro(
    t: ExecutionContext,
    yCbCr: readonly [number, number, number],
    expectedRGB: readonly [number, number, number]
): void {
    const rgb = Array.from(convertLumaChromaToColor(...yCbCr));

    t.deepEqual(rgb, expectedRGB);
}

test('converts 0,0,0', convertMacro, [ 0, 0, 0 ], [ 0, 135, 0 ]);
test('converts 255,255,255', convertMacro, [ 255, 255, 255 ], [ 255, 125, 255 ]);
test('converts white', convertMacro, [ 255, 128, 128 ], [ 255, 255, 255 ]);
test('converts red', convertMacro, [ 76, 85, 255 ], [ 255, 0, 0 ]);
test('converts green', convertMacro, [ 150, 44, 21 ], [ 0, 255, 0 ]);
test('converts orange', convertMacro, [ 173, 30, 186 ], [ 255, 174, 0 ]);
test('converts purple', convertMacro, [ 94, 210, 175 ], [ 165, 20, 255 ]);
test('converts yellow', convertMacro, [ 255, 1, 149 ], [ 255, 255, 22 ]);
test('converts brown', convertMacro, [ 79, 107, 190 ], [ 172, 31, 30 ]);
test('converts cyan', convertMacro, [ 179, 171, 1 ], [ 0, 255, 255 ]);
test('converts violet', convertMacro, [ 57, 174, 186 ], [ 140, 0, 140 ]);

test('reads a short bitstream without reading beyond its packet', function (t) {
    const packet = createPacket();
    packet.addSegment(new Uint8Array([ 165 ]));
    const stream = createBitstream(packet, 0);

    t.is(stream.nextBits(4), 10);
    t.is(stream.nextBits(4), 5);
    t.throws(function () {
        return stream.nextBits(1);
    }, { message: 'Bitstream: End of Stream' });
});

test('an empty bitstream permits zero bits and rejects a nonzero read', function (t) {
    const stream = createBitstream(createPacket(), 0);

    t.is(stream.nextBits(0), 0);
    t.throws(function () {
        return stream.nextBits(1);
    }, { message: 'Bitstream: End of Stream' });
});
