import test, { ExecutionContext } from 'ava';
import { yCbCrToRGB } from '../../../../src/lib/theora/util';

function convertMacro(
    t: ExecutionContext,
    yCbCr: [number, number, number],
    expectedRGB: [number, number, number]
): void {
    const rgb = [...yCbCrToRGB(...yCbCr)];

    t.deepEqual(rgb, expectedRGB);
}

test('converts 0,0,0', convertMacro, [0, 0, 0], [0, 135, 0]);
test('converts 255,255,255', convertMacro, [255, 255, 255], [255, 125, 255]);
test('converts white', convertMacro, [255, 128, 128], [255, 255, 255]);
test('converts red', convertMacro, [76, 85, 255], [255, 0, 0]);
test('converts green', convertMacro, [150, 44, 21], [0, 255, 0]);
test('converts orange', convertMacro, [173, 30, 186], [255, 174, 0]);
test('converts purple', convertMacro, [94, 210, 175], [165, 20, 255]);
test('converts yellow', convertMacro, [255, 1, 149], [255, 255, 22]);
test('converts brown', convertMacro, [79, 107, 190], [172, 31, 30]);
test('converts cyan', convertMacro, [179, 171, 1], [0, 255, 255]);
test('converts violet', convertMacro, [57, 174, 186], [140, 0, 140]);
