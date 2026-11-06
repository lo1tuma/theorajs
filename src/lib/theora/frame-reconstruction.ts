import { TheoraError } from './errors.ts';
import type { FrameMappings } from './frame-mappings.ts';
import type { FramePlan } from './frame-plan.ts';
import {
    type BlockPosition,
    type BlockSamples,
    type FramePlanes,
    type PixelCoordinate,
    type PlaneView,
    type PlaneViews,
    BLOCK_EDGE,
    blockPosition,
    createFramePlanes,
    createPlaneViews,
    planeForBlock
} from './frame-planes.ts';

import { referenceForMode } from './frame-references.ts';
import type { Header } from './header.ts';
import { INTRA_BLOCK, predictMotionBlock } from './motion-prediction.ts';
import { quantizedResidual } from './quantized-residual.ts';

const SAMPLE_MAXIMUM = 255;
const INTRA_MODE = 1;

export type FrameReferences = { readonly previous: FramePlanes | null; readonly golden: FramePlanes | null; };
export type FrameReconstruction = {
    readonly header: Header;
    readonly mappings: FrameMappings;
    readonly plan: FramePlan;
    readonly references: FrameReferences;
};
export type ReconstructedImage = FramePlanes & { readonly changedPixels: readonly PixelCoordinate[]; };
type ReferenceViews = { readonly previous: PlaneViews | null; readonly golden: PlaneViews | null; };
type MarkChange = (x: number, y: number) => void;
type ReconstructionContext = {
    readonly input: FrameReconstruction;
    readonly planes: PlaneViews;
    readonly references: ReferenceViews;
    readonly markChange: MarkChange;
};
type BlockRendering = {
    readonly plane: PlaneView;
    readonly position: BlockPosition;
    readonly prediction: BlockSamples;
    readonly residual: BlockSamples;
};

function blockPrediction(
    context: ReconstructionContext,
    block: number,
    plane: PlaneView,
    position: BlockPosition
): BlockSamples {
    const mode = context.input.plan.modes[context.input.mappings.blockToMacroblock(block)];
    const reference = referenceForMode(mode);
    if (reference === 0) {
        return INTRA_BLOCK;
    }
    const source = reference === 1 ? context.references.previous : context.references.golden;
    const { motion } = context.input.plan;
    if (source === null || motion === null) {
        throw new TheoraError('Missing frame motion reference.', {});
    }
    return predictMotionBlock(source[plane.index], position, motion.forBlock(block), context.input.header.pixelFormat);
}

function blockResidual(context: ReconstructionContext, block: number, plane: PlaneView): BlockSamples {
    const { plan } = context.input;
    const mode = plan.modes[context.input.mappings.blockToMacroblock(block)];
    return quantizedResidual({
        coefficients: plan.coefficients,
        block,
        quantizers: plan.coding.quantizers,
        selector: plan.selectors[block],
        quantization: context.input.header.quantization,
        type: mode === INTRA_MODE ? 0 : 1,
        plane: plane.index
    });
}

function writeBlock(block: BlockRendering, markChange: MarkChange): void {
    for (let row = 0; row < BLOCK_EDGE; row += 1) {
        for (let column = 0; column < BLOCK_EDGE; column += 1) {
            const targetColumn = block.position.x + column;
            const targetRow = block.position.y + row;
            const value = Math.min(
                SAMPLE_MAXIMUM,
                Math.max(0, block.prediction.sample(column, row) + block.residual.sample(column, row))
            );
            block.plane.data.setUint8(targetRow * block.plane.width + targetColumn, value);
            if (block.plane.index === 0) {
                markChange(targetColumn, targetRow);
            }
        }
    }
}

function reconstructBlock(context: ReconstructionContext, block: number): void {
    const plane = planeForBlock(context.planes, context.input.header, block);
    const position = blockPosition(plane, context.input.mappings.codedToRasterOrder(block));
    const prediction = blockPrediction(context, block, plane, position);
    const residual = blockResidual(context, block, plane);
    writeBlock({ plane, position, prediction, residual }, context.markChange);
}

function referenceViews(references: FrameReferences, header: Header): ReferenceViews {
    return {
        previous: references.previous === null ? null : createPlaneViews(references.previous, header),
        golden: references.golden === null ? null : createPlaneViews(references.golden, header)
    };
}

export function reconstructFrame(input: FrameReconstruction): ReconstructedImage {
    const frame = createFramePlanes(input.header, input.plan.coding.frameType === 0 ? null : input.references.previous);
    const changedPixels: PixelCoordinate[] = [];
    const context: ReconstructionContext = {
        input,
        planes: createPlaneViews(frame, input.header),
        references: referenceViews(input.references, input.header),
        markChange(column: number, row: number): void {
            changedPixels.push([ column, row ]);
        }
    };
    for (const block of input.plan.blocks.coded) {
        reconstructBlock(context, block);
    }
    return { ...frame, changedPixels };
}
