import type { BlockPosition, BlockSamples, PlaneView } from './frame-planes.ts';
import { directionSign } from './integer-math.ts';
import type { MotionVector } from './motion-vectors.ts';

const HALF_PIXEL_DIVISOR = 2;
const SUBSAMPLED_DIVISOR = 4;
const CHROMA_422 = 2;
const INTRA_SAMPLE = 128;

type Divisors = { readonly horizontal: number; readonly vertical: number; };
type Rounding = (value: number) => number;

export const INTRA_BLOCK: BlockSamples = {
    sample(): number {
        return INTRA_SAMPLE;
    }
};

function motionDivisors(plane: PlaneView, pixelFormat: number): Divisors {
    return {
        horizontal: plane.index !== 0 && (pixelFormat === 0 || pixelFormat === CHROMA_422)
            ? SUBSAMPLED_DIVISOR
            : HALF_PIXEL_DIVISOR,
        vertical: pixelFormat === 0 && plane.index !== 0 ? SUBSAMPLED_DIVISOR : HALF_PIXEL_DIVISOR
    };
}

function shiftedOrigin(
    position: BlockPosition,
    vector: MotionVector,
    divisors: Divisors,
    rounding: Rounding
): BlockPosition {
    const [ horizontal, vertical ] = vector;
    return {
        x: position.x + rounding(Math.abs(horizontal) / divisors.horizontal) * directionSign(horizontal),
        y: position.y + rounding(Math.abs(vertical) / divisors.vertical) * directionSign(vertical)
    };
}

function sampleReference(plane: PlaneView, horizontal: number, vertical: number): number {
    const column = Math.min(plane.width - 1, Math.max(0, horizontal));
    const row = Math.min(plane.height - 1, Math.max(0, vertical));
    return plane.data.getUint8(row * plane.width + column);
}

export function predictMotionBlock(
    plane: PlaneView,
    position: BlockPosition,
    vector: MotionVector,
    pixelFormat: number
): BlockSamples {
    const divisors = motionDivisors(plane, pixelFormat);
    const first = shiftedOrigin(position, vector, divisors, Math.floor);
    const second = shiftedOrigin(position, vector, divisors, Math.ceil);
    return {
        sample(column, row) {
            return Math.trunc(
                (sampleReference(plane, first.x + column, first.y + row) +
                    sampleReference(plane, second.x + column, second.y + row)) / HALF_PIXEL_DIVISOR
            );
        }
    };
}
