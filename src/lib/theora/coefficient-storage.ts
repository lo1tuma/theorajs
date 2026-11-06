import type { CoefficientRun } from './coefficient-tokens.ts';
import { TheoraError } from './errors.ts';

export const BLOCK_COEFFICIENTS = 64;
const COEFFICIENT_BYTES = Int16Array.BYTES_PER_ELEMENT;

type CoefficientProgress = {
    readonly position: (block: number) => number;
    readonly recordPosition: (block: number) => void;
    readonly finish: (block: number) => void;
    readonly apply: (block: number, run: CoefficientRun) => void;
};
export type Coefficients = {
    readonly value: (block: number, index: number) => number;
    readonly count: (block: number) => number;
    readonly setDirect: (block: number, value: number) => void;
};
export type CoefficientStorage = CoefficientProgress & { readonly coefficients: Coefficients; };

function coefficientBlock(blocks: readonly DataView[], index: number): DataView {
    const block = blocks[index];
    if (block === undefined) {
        throw new TheoraError('Missing coefficient block.', {});
    }
    return block;
}

function advanceCoefficients(block: DataView, position: number, run: CoefficientRun): number {
    const end = position + run.zeros + (run.value === null ? 0 : 1);
    if (end > BLOCK_COEFFICIENTS) {
        throw new TheoraError('Coefficient run exceeds block.', {});
    }
    if (run.value !== null) {
        block.setInt16((position + run.zeros) * COEFFICIENT_BYTES, run.value, true);
    }
    return end;
}

export function createCoefficientStorage(count: number): CoefficientStorage {
    const blocks = Array.from(
        { length: count },
        function () {
            return new DataView(new ArrayBuffer(BLOCK_COEFFICIENTS * COEFFICIENT_BYTES));
        }
    );
    const positions = new DataView(new ArrayBuffer(count));
    const counts = new DataView(new ArrayBuffer(count));
    return {
        position(block) {
            return positions.getUint8(block);
        },
        recordPosition(block) {
            counts.setUint8(block, positions.getUint8(block));
        },
        finish(block) {
            positions.setUint8(block, BLOCK_COEFFICIENTS);
        },
        apply(block: number, run: CoefficientRun): void {
            const position = advanceCoefficients(coefficientBlock(blocks, block), positions.getUint8(block), run);
            positions.setUint8(block, position);
            if (run.value !== null) {
                counts.setUint8(block, position);
            }
        },
        coefficients: {
            value(block, index) {
                return coefficientBlock(blocks, block).getInt16(index * COEFFICIENT_BYTES, true);
            },
            count(block) {
                return counts.getUint8(block);
            },
            setDirect(block, value) {
                coefficientBlock(blocks, block).setInt16(0, value, true);
            }
        }
    };
}
