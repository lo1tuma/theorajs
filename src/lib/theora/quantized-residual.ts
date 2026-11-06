import { shiftSignedRight } from '../stream/integer-arithmetic.ts';
import type { Coefficients } from './coefficient-storage.ts';
import { ZIG_ZAG_ORDER_MAPPING_TABLE } from './constants.ts';
import { TheoraError } from './errors.ts';
import type { FrameCoding } from './frame-header.ts';
import type { BlockSamples } from './frame-planes.ts';
import type { Quantization } from './headers/quantization.ts';
import { limitTransformSignal } from './integer-math.ts';
import { invertCosineTransform } from './inverse-transform.ts';

const FIRST_ALTERNATING_COEFFICIENT = 2;
const DIRECT_ROUNDING_BIAS = 15;
const DIRECT_SCALE_BITS = 5;
const ZIG_ORDER = ZIG_ZAG_ORDER_MAPPING_TABLE.flat();

export type ResidualCoding = {
    readonly coefficients: Coefficients;
    readonly block: number;
    readonly quantizers: FrameCoding['quantizers'];
    readonly selector: number | undefined;
    readonly quantization: Quantization;
    readonly type: number;
    readonly plane: number;
};

function directResidual(coding: ResidualCoding): BlockSamples {
    const matrix = coding.quantization.matrix(coding.type, coding.plane, coding.quantizers[0]);
    const scaled = coding.coefficients.value(coding.block, 0) * matrix.coefficient(0) + DIRECT_ROUNDING_BIAS;
    const value = limitTransformSignal(shiftSignedRight(scaled, DIRECT_SCALE_BITS));
    return {
        sample() {
            return value;
        }
    };
}

function selectedQuality(coding: ResidualCoding): number {
    if (coding.selector === undefined) {
        throw new TheoraError('Missing block quantizer selector.', {});
    }
    const quality = coding.quantizers[coding.selector];
    if (quality === undefined) {
        throw new TheoraError('Missing block quantizer.', {});
    }
    return quality;
}

function dequantize(coding: ResidualCoding, quality: number): readonly number[] {
    const direct = coding.quantization.matrix(coding.type, coding.plane, coding.quantizers[0]);
    const alternating = coding.quantization.matrix(coding.type, coding.plane, quality);
    return ZIG_ORDER.map(function (source, index) {
        const matrix = index === 0 ? direct : alternating;
        return limitTransformSignal(coding.coefficients.value(coding.block, source) * matrix.coefficient(index));
    });
}

export function quantizedResidual(coding: ResidualCoding): BlockSamples {
    return coding.coefficients.count(coding.block) < FIRST_ALTERNATING_COEFFICIENT
        ? directResidual(coding)
        : invertCosineTransform(dequantize(coding, selectedQuality(coding)));
}
