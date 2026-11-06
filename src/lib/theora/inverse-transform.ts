import { shiftSignedRight } from '../stream/integer-arithmetic.ts';
import { COSINES, SINES } from './constants.ts';
import type { BlockSamples } from './frame-planes.ts';
import { limitTransformSignal } from './integer-math.ts';

const FRACTION_BITS = 16;
const BLOCK_EDGE = 8;
const FINAL_ROUNDING_BIAS = 8;
const FINAL_SCALE_BITS = 4;

type Signal = readonly [number, number, number, number, number, number, number, number];

function rotateSignal(value: number, factor: number): number {
    return shiftSignedRight(value * factor, FRACTION_BITS);
}

function rotateInputs(input: Signal): Signal {
    const [ first, second, third, fourth, fifth, sixth, seventh, eighth ] = input;
    return [
        rotateSignal(limitTransformSignal(first + fifth), COSINES.fourth),
        rotateSignal(limitTransformSignal(first - fifth), COSINES.fourth),
        rotateSignal(third, COSINES.sixth) - rotateSignal(seventh, SINES.sixth),
        rotateSignal(third, SINES.sixth) + rotateSignal(seventh, COSINES.sixth),
        rotateSignal(second, COSINES.seventh) - rotateSignal(eighth, SINES.seventh),
        rotateSignal(sixth, COSINES.third) - rotateSignal(fourth, SINES.third),
        rotateSignal(sixth, SINES.third) + rotateSignal(fourth, COSINES.third),
        rotateSignal(second, SINES.seventh) + rotateSignal(eighth, COSINES.seventh)
    ];
}

function rotateOddSignals(input: Signal): Signal {
    const [ first, second, third, fourth, fifth, sixth, seventh, eighth ] = input;
    return [
        first,
        second,
        third,
        fourth,
        fifth + sixth,
        rotateSignal(limitTransformSignal(fifth - sixth), COSINES.fourth),
        rotateSignal(limitTransformSignal(eighth - seventh), COSINES.fourth),
        eighth + seventh
    ];
}

function combineSignals(input: Signal): Signal {
    const [ first, second, third, fourth, fifth, sixth, seventh, eighth ] = input;
    return [
        first + fourth,
        second + third,
        second - third,
        first - fourth,
        fifth,
        seventh - sixth,
        seventh + sixth,
        eighth
    ];
}

function finishSignals(input: Signal): Signal {
    const [ first, second, third, fourth, fifth, sixth, seventh, eighth ] = input;
    return [
        limitTransformSignal(first + eighth),
        limitTransformSignal(second + seventh),
        limitTransformSignal(third + sixth),
        limitTransformSignal(fourth + fifth),
        limitTransformSignal(fourth - fifth),
        limitTransformSignal(third - sixth),
        limitTransformSignal(second - seventh),
        limitTransformSignal(first - eighth)
    ];
}

function transformSignal(input: Signal): Signal {
    return finishSignals(combineSignals(rotateOddSignals(rotateInputs(input))));
}

function signalView(values: readonly number[]): DataView {
    const data = new DataView(new ArrayBuffer(values.length * Float64Array.BYTES_PER_ELEMENT));
    values.forEach(function (value, index) {
        data.setFloat64(index * Float64Array.BYTES_PER_ELEMENT, value, true);
    });
    return data;
}

function readSignal(data: DataView, offset: number, stride: number): Signal {
    let position = offset;
    function next(): number {
        const value = data.getFloat64(position * Float64Array.BYTES_PER_ELEMENT, true);
        position += stride;
        return value;
    }
    return [ next(), next(), next(), next(), next(), next(), next(), next() ];
}

export function invertCosineTransform(coefficients: readonly number[]): BlockSamples {
    const input = signalView(coefficients);
    const rows = Array.from(
        { length: BLOCK_EDGE },
        function (_value, row) {
            return transformSignal(readSignal(input, row * BLOCK_EDGE, 1));
        }
    );
    const rowSignals = signalView(rows.flat());
    const columns = Array.from(
        { length: BLOCK_EDGE },
        function (_value, column) {
            return transformSignal(readSignal(rowSignals, column, BLOCK_EDGE));
        }
    );
    const columnSignals = signalView(columns.flat());
    return {
        sample(column, row) {
            const value = columnSignals.getFloat64((column * BLOCK_EDGE + row) * Float64Array.BYTES_PER_ELEMENT, true);
            return shiftSignedRight(value + FINAL_ROUNDING_BIAS, FINAL_SCALE_BITS);
        }
    };
}
