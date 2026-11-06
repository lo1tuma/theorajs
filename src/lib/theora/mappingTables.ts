import { COLUMN_MAPPING_TABLE, ROW_MAPPING_TABLE } from './constants.ts';
import { TheoraError } from './errors.ts';

const SUPERBLOCK_EDGE = 4;
const MACROBLOCK_EDGE = 2;
const MACROBLOCK_GROUP_SIZE = 4;
const LOWER_RIGHT = 3;
const UPPER_RIGHT = 2;
const CHROMA_422 = 2;
const RED_PLANE = 2;

type Dimensions = { readonly width: number; readonly height: number; };
type Superblock = Dimensions & { readonly x: number; readonly y: number; };
type Position = { readonly x: number; readonly y: number; };

function superblocks(width: number, height: number): readonly Superblock[] {
    const columns = Math.ceil(width / SUPERBLOCK_EDGE);
    const rows = Math.ceil(height / SUPERBLOCK_EDGE);
    return Array.from({ length: rows * columns }, function (_value, index) {
        const column = index % columns * SUPERBLOCK_EDGE;
        const row = Math.trunc(index / columns) * SUPERBLOCK_EDGE;
        return {
            x: column,
            y: row,
            width: Math.min(SUPERBLOCK_EDGE, width - column),
            height: Math.min(SUPERBLOCK_EDGE, height - row)
        };
    });
}

function tilePositions(tile: Superblock): readonly Position[] {
    const rows = ROW_MAPPING_TABLE[tile.width - 1]?.[tile.height - 1];
    const columns = COLUMN_MAPPING_TABLE[tile.width - 1]?.[tile.height - 1];
    if (rows === undefined || columns === undefined) {
        throw new TheoraError('Invalid superblock dimensions.', {});
    }
    return rows.map(function (row, index) {
        const column = columns[index];
        if (column === undefined) {
            throw new TheoraError('Missing superblock column.', {});
        }
        return { x: tile.x + column, y: tile.y + row };
    });
}

export function computeSuperBlockSizes(width: number, height: number): number[] {
    return superblocks(width, height).map(function (tile) {
        return tile.width * tile.height;
    });
}

export function computeBlockToSuperBlockTable(
    width: number,
    height: number,
    sizes: readonly number[],
    offset: number
): number[] {
    const table = sizes.flatMap(function (size, index) {
        return Array.from({ length: size }, function () {
            return index + offset;
        });
    });
    if (table.length !== width * height) {
        throw new TheoraError('Invalid superblock sizes.', {});
    }
    return table;
}

export function computeRasterToCodedOrderMappingTable(width: number, height: number, offset: number): number[] {
    const table: number[] = [];
    superblocks(width, height).flatMap(tilePositions).forEach(function (position, index) {
        table[position.y * width + position.x] = index + offset;
    });
    return table;
}

function groupPosition(row: number, column: number): number {
    if (row === 0) {
        return column === 0 ? 0 : LOWER_RIGHT;
    }
    return column === 0 ? 1 : UPPER_RIGHT;
}

function codedMacroblock(frame: Dimensions, row: number, column: number): number {
    const parity = row % MACROBLOCK_EDGE;
    if (parity === 0 && row === frame.height - 1) {
        return row * frame.width + column;
    }
    const withinColumn = column % MACROBLOCK_EDGE;
    const withinGroup = groupPosition(parity, withinColumn);
    return (row - parity) * frame.width + Math.trunc(column / MACROBLOCK_EDGE) * MACROBLOCK_GROUP_SIZE + withinGroup;
}

function macroblockDimensions(plane: number, pixelFormat: number): Dimensions {
    if (plane === 0) {
        return { width: MACROBLOCK_EDGE, height: MACROBLOCK_EDGE };
    }
    return {
        width: pixelFormat === 0 || pixelFormat === CHROMA_422 ? 1 : MACROBLOCK_EDGE,
        height: pixelFormat === 0 ? 1 : MACROBLOCK_EDGE
    };
}

export function computeMacroBlockMappingTables(
    frameWidth: number,
    frameHeight: number,
    pixelFormat: number,
    rasterToCodedOrder: readonly number[]
): readonly [number[], number[][]] {
    const byBlock: number[] = [];
    const byMacroblock: number[][] = [];
    const frame = { width: frameWidth, height: frameHeight };
    let raster = 0;
    function appendBlock(macroblock: number): void {
        const block = rasterToCodedOrder[raster];
        if (block === undefined) {
            throw new TheoraError('Missing coded block mapping.', {});
        }
        raster += 1;
        byBlock[block] = macroblock;
        const blocks = byMacroblock[macroblock] ?? [];
        blocks.push(block);
        byMacroblock[macroblock] = blocks;
    }
    function appendPlane(dimensions: Dimensions): void {
        for (let row = 0; row < frameHeight * dimensions.height; row += 1) {
            for (let column = 0; column < frameWidth * dimensions.width; column += 1) {
                appendBlock(
                    codedMacroblock(frame, Math.trunc(row / dimensions.height), Math.trunc(column / dimensions.width))
                );
            }
        }
    }
    for (const plane of [ 0, 1, RED_PLANE ]) {
        appendPlane(macroblockDimensions(plane, pixelFormat));
    }
    return [ byBlock, byMacroblock ];
}

export function invertBlockOrder(order: readonly number[]): number[] {
    const inverse: number[] = [];
    for (const [ raster, coded ] of order.entries()) {
        inverse[coded] = raster;
    }
    return inverse;
}
