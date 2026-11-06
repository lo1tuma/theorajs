import { TheoraError } from './errors.ts';
import type { Header } from './header.ts';
import {
    computeBlockToSuperBlockTable,
    computeMacroBlockMappingTables,
    computeRasterToCodedOrderMappingTable,
    computeSuperBlockSizes,
    invertBlockOrder
} from './mappingTables.ts';

export type FrameMappings = {
    readonly blockToSuperblock: (index: number) => number;
    readonly blockToMacroblock: (index: number) => number;
    readonly rasterToCodedOrder: (index: number) => number;
    readonly codedToRasterOrder: (index: number) => number;
    readonly superBlockSize: (index: number) => number;
    readonly macroblockToBlocks: (index: number) => readonly number[];
};
type PlaneMapping = { readonly width: number; readonly height: number; readonly sizes: readonly number[]; };

function compileIndexMap(values: readonly number[]): (index: number) => number {
    const data = new DataView(new ArrayBuffer(values.length * Uint32Array.BYTES_PER_ELEMENT));
    for (const [ index, value ] of values.entries()) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new TheoraError('Invalid frame block mapping.', {});
        }
        data.setUint32(index * Uint32Array.BYTES_PER_ELEMENT, value, true);
    }
    return function readIndex(index: number): number {
        if (!Number.isSafeInteger(index)) {
            throw new TheoraError('Invalid frame block index.', {});
        }
        return data.getUint32(index * Uint32Array.BYTES_PER_ELEMENT, true);
    };
}

function planeMappings(header: Header): readonly PlaneMapping[] {
    const luma = {
        width: header.lumaBlockWidth,
        height: header.lumaBlockHeight,
        sizes: computeSuperBlockSizes(header.lumaBlockWidth, header.lumaBlockHeight)
    };
    const chroma = {
        width: header.chromaBlockWidth,
        height: header.chromaBlockHeight,
        sizes: computeSuperBlockSizes(header.chromaBlockWidth, header.chromaBlockHeight)
    };
    return [ luma, chroma, chroma ];
}

function blockToSuperblocks(planes: readonly PlaneMapping[]): readonly number[] {
    let offset = 0;
    return planes.flatMap(function (plane) {
        const values = computeBlockToSuperBlockTable(plane.width, plane.height, plane.sizes, offset);
        offset += plane.sizes.length;
        return values;
    });
}

function rasterToCodedBlocks(planes: readonly PlaneMapping[]): readonly number[] {
    let offset = 0;
    return planes.flatMap(function (plane) {
        const values = computeRasterToCodedOrderMappingTable(plane.width, plane.height, offset);
        offset += plane.width * plane.height;
        return values;
    });
}

export function createFrameMappings(header: Header): FrameMappings {
    const planes = planeMappings(header);
    const rasterToCodedOrder = rasterToCodedBlocks(planes);
    const [ blockToMacroblock, macroblockToBlocks ] = computeMacroBlockMappingTables(
        header.frameMacroblockWidth,
        header.frameMacroblockHeight,
        header.pixelFormat,
        rasterToCodedOrder
    );
    return {
        blockToSuperblock: compileIndexMap(blockToSuperblocks(planes)),
        blockToMacroblock: compileIndexMap(blockToMacroblock),
        rasterToCodedOrder: compileIndexMap(rasterToCodedOrder),
        codedToRasterOrder: compileIndexMap(invertBlockOrder(rasterToCodedOrder)),
        superBlockSize: compileIndexMap(planes.flatMap(function (plane) {
            return plane.sizes;
        })),
        macroblockToBlocks(index: number): readonly number[] {
            const blocks = macroblockToBlocks[index];
            if (blocks === undefined) {
                throw new TheoraError('Invalid macroblock index.', {});
            }
            return blocks;
        }
    };
}
