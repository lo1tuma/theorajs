import test from 'ava';
import {
    combineBits,
    maskBits,
    shiftSignedLeft,
    shiftSignedRight,
    shiftUnsignedRight,
    toSignedInteger
} from '../../../../src/lib/stream/integer-arithmetic.ts';

test('signed conversion wraps overflow and truncates fractions', function (t) {
    t.is(toSignedInteger(4_294_967_295), -1);
    t.is(toSignedInteger(4_294_967_297), 1);
    t.is(toSignedInteger(-1.75), -1);
    t.is(toSignedInteger(Number.NaN), 0);
});

test('signed shifts preserve coefficient overflow and negative rounding', function (t) {
    t.is(shiftSignedLeft(32_768, 16), -2_147_483_648);
    t.is(shiftSignedRight(-3, 1), -2);
    t.is(shiftSignedLeft(1, 32), 1);
});

test('unsigned shifts discard the sign bit', function (t) {
    t.is(shiftUnsignedRight(-1, 1), 2_147_483_647);
    t.is(shiftUnsignedRight(-1, 0), 4_294_967_295);
});

test('field assembly and masking preserve packet bits', function (t) {
    t.is(combineBits(2_147_483_648, 5), -2_147_483_643);
    t.is(maskBits(-1, 65_535), 65_535);
    t.is(maskBits(255, 7), 7);
});
