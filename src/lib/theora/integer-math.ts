import { shiftUnsignedRight } from '../stream/integer-arithmetic.ts';

const INTEGER_BITS = 32;

export function directionSign(value: number): -1 | 1 {
    return value < 0 ? -1 : 1;
}

export function integerBitWidth(value: number): number {
    const unsigned = shiftUnsignedRight(value, 0);
    return value === 0 ? 0 : Math.max(1, INTEGER_BITS - Math.clz32(unsigned));
}

const TRANSFORM_SIGNAL_LIMIT = 32_768;

export function limitTransformSignal(value: number): number {
    return Math.min(TRANSFORM_SIGNAL_LIMIT, Math.max(-TRANSFORM_SIGNAL_LIMIT, value));
}
