import { toSignedInteger } from '../../stream/integer-arithmetic.ts';
import { TheoraError } from '../errors.ts';
import { integerBitWidth } from '../integer-math.ts';
import type { Bitstream } from '../packet-bits.ts';

const COEFFICIENT_COUNT = 64;
const LAST_QUALITY = 63;
const REMAINING_QUALITY_BITS = 62;
const SCALE_LENGTH_BITS = 4;
const BASE_MATRIX_COUNT_BITS = 9;
const MAXIMUM_BASE_MATRICES = 384;
const BYTE_BITS = 8;
const PLANE_COUNT = 3;
const PROFILE_COUNT = 6;
const COEFFICIENT_BYTES = 2;
const SCALE_DIVISOR = 100;
const QUANTIZATION_MULTIPLIER = 4;
const MAXIMUM_QUANTIZATION = 4096;
const DIRECT_MINIMUM = 16;
const ALTERNATING_MINIMUM = 8;
const INTER_DIRECT_MINIMUM = 32;
const INTER_TYPE = 1;
const INTERPOLATION_MULTIPLIER = 2;

type Scales = { readonly direct: number; readonly alternating: number; };
type QuantizationRange = {
    readonly start: number;
    readonly end: number;
    readonly left: DataView;
    readonly right: DataView;
};

export type QuantizationMatrix = { readonly coefficient: (index: number) => number; };
export type Quantization = {
    readonly matrix: (type: number, plane: number, quality: number) => QuantizationMatrix;
};

function readScales(reader: Bitstream): readonly number[] {
    const bits = reader.nextBits(SCALE_LENGTH_BITS) + 1;
    return Array.from({ length: COEFFICIENT_COUNT }, function () {
        return reader.nextUBits(bits);
    });
}

function readScalePairs(reader: Bitstream): readonly Scales[] {
    const alternatingScales = readScales(reader);
    return readScales(reader).map(function combineScales(direct, index) {
        const alternating = alternatingScales[index];
        if (alternating === undefined) {
            throw new TheoraError('Missing quantization scale.', {});
        }
        return { direct, alternating };
    });
}

function readBaseMatrices(reader: Bitstream): readonly DataView[] {
    const count = reader.nextBits(BASE_MATRIX_COUNT_BITS) + 1;
    if (count > MAXIMUM_BASE_MATRICES) {
        throw new TheoraError('Number of base matrices is too high.', {});
    }
    return Array.from({ length: count }, function readMatrix() {
        const bytes = new Uint8Array(Array.from({ length: COEFFICIENT_COUNT }, function () {
            return reader.nextBits(BYTE_BITS);
        }));
        return new DataView(bytes.buffer);
    });
}

function readBaseMatrix(reader: Bitstream, matrices: readonly DataView[]): DataView {
    const index = reader.nextBits(integerBitWidth(matrices.length - 1));
    const matrix = matrices[index];
    if (matrix === undefined) {
        throw new TheoraError('Stream is undecodable.', {});
    }
    return matrix;
}

function readRanges(reader: Bitstream, matrices: readonly DataView[]): readonly QuantizationRange[] {
    const ranges: QuantizationRange[] = [];
    let boundary = { start: 0, left: readBaseMatrix(reader, matrices) };
    while (boundary.start < LAST_QUALITY) {
        const end = boundary.start + reader.nextBits(integerBitWidth(REMAINING_QUALITY_BITS - boundary.start)) + 1;
        const right = readBaseMatrix(reader, matrices);
        ranges.push({ ...boundary, end, right });
        boundary = { start: end, left: right };
    }
    if (boundary.start > LAST_QUALITY) {
        throw new TheoraError('Stream is undecodable.', {});
    }
    return ranges;
}

function readProfile(
    reader: Bitstream,
    matrices: readonly DataView[],
    previous: readonly (readonly QuantizationRange[])[]
): readonly QuantizationRange[] {
    const index = previous.length;
    if (index === 0 || reader.nextBits(1) === 1) {
        return readRanges(reader, matrices);
    }
    const repeatType = index >= PLANE_COUNT && reader.nextBits(1) === 1;
    const profile = previous[index - (repeatType ? PLANE_COUNT : 1)];
    if (profile === undefined) {
        throw new TheoraError('Missing previous quantization ranges.', {});
    }
    return profile;
}

function minimumCoefficient(index: number, type: number): number {
    if (index === 0) {
        return type === INTER_TYPE ? INTER_DIRECT_MINIMUM : DIRECT_MINIMUM;
    }
    return type === 0 ? ALTERNATING_MINIMUM : DIRECT_MINIMUM;
}

function interpolateBase(range: QuantizationRange, quality: number, coefficient: number): number {
    const width = range.end - range.start;
    return toSignedInteger(
        (INTERPOLATION_MULTIPLIER * (range.end - quality) * range.left.getUint8(coefficient) +
            INTERPOLATION_MULTIPLIER * (quality - range.start) * range.right.getUint8(coefficient) + width) /
            (INTERPOLATION_MULTIPLIER * width)
    );
}

function interpolateMatrix(
    ranges: readonly QuantizationRange[],
    scales: Scales,
    quality: number,
    type: number
): QuantizationMatrix {
    const range = ranges.find(function (candidate) {
        return candidate.start <= quality && quality <= candidate.end;
    });
    if (range === undefined) {
        throw new TheoraError('Missing quantization range.', {});
    }
    const data = new DataView(new ArrayBuffer(COEFFICIENT_COUNT * COEFFICIENT_BYTES));
    for (let index = 0; index < COEFFICIENT_COUNT; index += 1) {
        const base = interpolateBase(range, quality, index);
        const scale = index === 0 ? scales.direct : scales.alternating;
        const value = Math.max(
            minimumCoefficient(index, type),
            Math.min(toSignedInteger(scale * base / SCALE_DIVISOR) * QUANTIZATION_MULTIPLIER, MAXIMUM_QUANTIZATION)
        );
        data.setUint16(index * COEFFICIENT_BYTES, value, true);
    }
    return {
        coefficient(index) {
            return data.getUint16(index * COEFFICIENT_BYTES, true);
        }
    };
}

export function readQuantization(reader: Bitstream): Quantization {
    const scales = readScalePairs(reader);
    const matrices = readBaseMatrices(reader);
    const profiles: (readonly QuantizationRange[])[] = [];
    for (let index = 0; index < PROFILE_COUNT; index += 1) {
        profiles.push(readProfile(reader, matrices, profiles));
    }
    const tables = profiles.map(function (ranges, index) {
        return scales.map(function (scale, quality) {
            return interpolateMatrix(ranges, scale, quality, Math.trunc(index / PLANE_COUNT));
        });
    });
    return {
        matrix(type: number, plane: number, quality: number): QuantizationMatrix {
            const matrix = tables[type * PLANE_COUNT + plane]?.[quality];
            if (matrix === undefined) {
                throw new TheoraError('Missing quantization matrix.', {});
            }
            return matrix;
        }
    };
}
