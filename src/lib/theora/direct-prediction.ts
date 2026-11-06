import { toSignedInteger } from '../stream/integer-arithmetic.ts';
import type { Coefficients } from './coefficient-storage.ts';
import { DIRECT_PREDICTION_WEIGHTS } from './constants.ts';
import { TheoraError } from './errors.ts';
import type { FrameMappings } from './frame-mappings.ts';
import { type ReferenceIndex, referenceForMode } from './frame-references.ts';

import type { Header } from './header.ts';

const PREDICTION_TOLERANCE = 128;

type PredictionHeader = Pick<Header, 'chromaBlockCount' | 'chromaBlockWidth' | 'lumaBlockCount' | 'lumaBlockWidth'>;
export type PredictionCoding = {
    readonly header: PredictionHeader;
    readonly mappings: FrameMappings;
    readonly modes: readonly number[];
    readonly flags: readonly number[];
};
type Neighbors = {
    readonly left: number | null;
    readonly lowerLeft: number | null;
    readonly lower: number | null;
    readonly lowerRight: number | null;
};
type BlockGrid = { readonly width: number; readonly offset: number; };
type PlaneBlocks = { readonly count: number; readonly offset: number; };
type PredictionContext = {
    readonly coding: PredictionCoding;
    readonly coefficients: Coefficients;
    readonly reference: ReferenceIndex;
};

function blockGrid(header: PredictionHeader, block: number): BlockGrid {
    if (block >= header.lumaBlockCount + header.chromaBlockCount) {
        return { width: header.chromaBlockWidth, offset: header.lumaBlockCount + header.chromaBlockCount };
    }
    return block >= header.lumaBlockCount
        ? { width: header.chromaBlockWidth, offset: header.lumaBlockCount }
        : { width: header.lumaBlockWidth, offset: 0 };
}

function sampleNeighbor(context: PredictionContext, raster: number | null): number | null {
    if (raster === null) {
        return null;
    }
    const block = context.coding.mappings.rasterToCodedOrder(raster);
    if (context.coding.flags[block] === 0) {
        return null;
    }
    const mode = context.coding.modes[context.coding.mappings.blockToMacroblock(block)];
    return referenceForMode(mode) === context.reference ? context.coefficients.value(block, 0) : null;
}

function neighborRaster(grid: BlockGrid, raster: number, columnOffset: number, rowOffset: number): number | null {
    const column = raster % grid.width + columnOffset;
    const row = Math.trunc(raster / grid.width) + rowOffset;
    return column < 0 || column >= grid.width || row < 0 ? null : row * grid.width + column + grid.offset;
}

function neighboringCoefficients(context: PredictionContext, block: number): Neighbors {
    const grid = blockGrid(context.coding.header, block);
    const raster = context.coding.mappings.codedToRasterOrder(block) - grid.offset;
    return {
        left: sampleNeighbor(context, neighborRaster(grid, raster, -1, 0)),
        lowerLeft: sampleNeighbor(context, neighborRaster(grid, raster, -1, -1)),
        lower: sampleNeighbor(context, neighborRaster(grid, raster, 0, -1)),
        lowerRight: sampleNeighbor(context, neighborRaster(grid, raster, 1, -1))
    };
}

function weightedPrediction(neighbors: Neighbors): number {
    const mask = [ neighbors.left, neighbors.lowerLeft, neighbors.lower, neighbors.lowerRight ]
        .map(function (value) {
            return value === null ? 0 : 1;
        })
        .join('');
    const specification = DIRECT_PREDICTION_WEIGHTS[mask];
    if (specification === undefined) {
        throw new TheoraError('Invalid direct prediction neighbors.', {});
    }
    const { weights } = specification;
    const total = (neighbors.left ?? 0) * weights.left + (neighbors.lowerLeft ?? 0) * weights.lowerLeft +
        (neighbors.lower ?? 0) * weights.lower + (neighbors.lowerRight ?? 0) * weights.lowerRight;
    return toSignedInteger(total / specification.divisor);
}

function refinePrediction(prediction: number, neighbors: Neighbors): number {
    if (neighbors.left === null || neighbors.lowerLeft === null || neighbors.lower === null) {
        return prediction;
    }
    return [ neighbors.lower, neighbors.left, neighbors.lowerLeft ]
        .find(function (value) {
            return Math.abs(prediction - value) > PREDICTION_TOLERANCE;
        }) ?? prediction;
}

type BlockPrediction = { readonly reference: ReferenceIndex; readonly value: number; };

function predictBlock(
    coefficients: Coefficients,
    coding: PredictionCoding,
    previous: ReadonlyMap<ReferenceIndex, number>,
    block: number
): BlockPrediction | null {
    if (coding.flags[block] === 0) {
        return null;
    }
    const reference = referenceForMode(coding.modes[coding.mappings.blockToMacroblock(block)]);
    const neighbors = neighboringCoefficients({ coding, coefficients, reference }, block);
    const hasNoNeighbors = Object.values(neighbors).every(function (value) {
        return value === null;
    });
    const prediction = hasNoNeighbors
        ? previous.get(reference) ?? 0
        : refinePrediction(weightedPrediction(neighbors), neighbors);
    coefficients.setDirect(block, coefficients.value(block, 0) + prediction);
    return { reference, value: coefficients.value(block, 0) };
}

function invertPlane(coefficients: Coefficients, coding: PredictionCoding, plane: PlaneBlocks): void {
    const previous = new Map<ReferenceIndex, number>();
    for (let raster = 0; raster < plane.count; raster += 1) {
        const prediction = predictBlock(
            coefficients,
            coding,
            previous,
            coding.mappings.rasterToCodedOrder(raster + plane.offset)
        );
        if (prediction !== null) {
            previous.set(prediction.reference, prediction.value);
        }
    }
}

export function invertDirectPrediction(coefficients: Coefficients, coding: PredictionCoding): void {
    const { header } = coding;
    const planes = [ { count: header.lumaBlockCount, offset: 0 }, {
        count: header.chromaBlockCount,
        offset: header.lumaBlockCount
    }, { count: header.chromaBlockCount, offset: header.lumaBlockCount + header.chromaBlockCount } ];
    for (const plane of planes) {
        invertPlane(coefficients, coding, plane);
    }
}
