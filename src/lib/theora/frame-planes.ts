import type { Header } from './header.ts';

export const BLOCK_EDGE = 8;
const MACROBLOCK_EDGE = 16;
const CHROMA_422 = 2;
const RED_PLANE = 2;

export type FramePlanes = {
    readonly lumaPlane: Uint8Array;
    readonly blueChromaPlane: Uint8Array;
    readonly redChromaPlane: Uint8Array;
    readonly lumaWidth: number;
    readonly lumaHeight: number;
    readonly chromaWidth: number;
    readonly chromaHeight: number;
};
export type PlaneView = {
    readonly index: typeof RED_PLANE | 0 | 1;
    readonly offset: number;
    readonly width: number;
    readonly height: number;
    readonly data: DataView;
};
export type PlaneViews = readonly [PlaneView, PlaneView, PlaneView];
export type BlockPosition = { readonly x: number; readonly y: number; };

function view(samples: Uint8Array): DataView {
    return new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
}

export function createPlaneViews(frame: FramePlanes, header: Header): PlaneViews {
    return [
        { index: 0, offset: 0, width: frame.lumaWidth, height: frame.lumaHeight, data: view(frame.lumaPlane) },
        {
            index: 1,
            offset: header.lumaBlockCount,
            width: frame.chromaWidth,
            height: frame.chromaHeight,
            data: view(frame.blueChromaPlane)
        },
        {
            index: RED_PLANE,
            offset: header.lumaBlockCount + header.chromaBlockCount,
            width: frame.chromaWidth,
            height: frame.chromaHeight,
            data: view(frame.redChromaPlane)
        }
    ];
}

export function planeForBlock(planes: PlaneViews, header: Header, block: number): PlaneView {
    if (block >= header.lumaBlockCount + header.chromaBlockCount) {
        return planes[RED_PLANE];
    }
    return block >= header.lumaBlockCount ? planes[1] : planes[0];
}

export function blockPosition(plane: PlaneView, raster: number): BlockPosition {
    const column = (raster - plane.offset) * BLOCK_EDGE % plane.width;
    const row = ((raster - plane.offset) * BLOCK_EDGE - column) / plane.width * BLOCK_EDGE;
    return { x: column, y: row };
}

function copyPlane(reference: Uint8Array | undefined, size: number): Uint8Array {
    return reference === undefined ? new Uint8Array(size) : new Uint8Array(reference);
}

type PlaneDimensions = Pick<FramePlanes, 'chromaHeight' | 'chromaWidth' | 'lumaHeight' | 'lumaWidth'>;

function frameDimensions(header: Header): PlaneDimensions {
    const lumaWidth = MACROBLOCK_EDGE * header.frameMacroblockWidth;
    const lumaHeight = MACROBLOCK_EDGE * header.frameMacroblockHeight;
    const chromaWidth = (header.pixelFormat === 0 || header.pixelFormat === CHROMA_422 ? BLOCK_EDGE : MACROBLOCK_EDGE) *
        header.frameMacroblockWidth;
    const chromaHeight = (header.pixelFormat === 0 ? BLOCK_EDGE : MACROBLOCK_EDGE) * header.frameMacroblockHeight;
    return { lumaWidth, lumaHeight, chromaWidth, chromaHeight };
}

export function createFramePlanes(header: Header, reference: FramePlanes | null): FramePlanes {
    const dimensions = frameDimensions(header);
    const { lumaWidth, lumaHeight, chromaWidth, chromaHeight } = dimensions;
    return {
        ...dimensions,
        lumaPlane: copyPlane(reference?.lumaPlane, lumaWidth * lumaHeight),
        blueChromaPlane: copyPlane(reference?.blueChromaPlane, chromaWidth * chromaHeight),
        redChromaPlane: copyPlane(reference?.redChromaPlane, chromaWidth * chromaHeight)
    };
}

export type BlockSamples = { readonly sample: (x: number, y: number) => number; };
export type PixelCoordinate = readonly [x: number, y: number];
