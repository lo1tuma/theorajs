import type { Packet } from '../../ogg/packet.ts';
import { maskBits, shiftSignedRight } from '../../stream/integer-arithmetic.ts';
import { TheoraError } from '../errors.ts';
import { beginHeader } from './protocol.ts';

const IDENTIFICATION_TYPE = 0x80;
const QUALITY_SHIFT = 10;
const KEY_FRAME_SHIFT = 5;
const KEY_FRAME_MASK = 0x1F;
const PIXEL_FORMAT_SHIFT = 3;
const PIXEL_FORMAT_MASK = 0x03;
const RESERVED_MASK = 0x07;
const CHROMA_422 = 2;
const CHROMA_444 = 3;
const BLOCKS_PER_MACROBLOCK_EDGE = 2;
const BLOCKS_PER_LUMA_MACROBLOCK = 4;
const BLOCKS_PER_420_MACROBLOCK = 6;
const BLOCKS_PER_422_MACROBLOCK = 8;
const BLOCKS_PER_444_MACROBLOCK = 12;
const BLOCKS_PER_SUPERBLOCK_EDGE = 4;
const CHROMA_PLANES = 2;
const FULL_PLANES = 3;
const SUPERBLOCK_ROUNDING = 3;

export type PixelFormat = typeof CHROMA_422 | typeof CHROMA_444 | 0;

type FrameDimensions = {
    readonly frameMacroblockWidth: number;
    readonly frameMacroblockHeight: number;
};

type PictureDimensions = FrameDimensions & {
    readonly pictureWidth: number;
    readonly pictureHeight: number;
    readonly pictureXOffset: number;
    readonly pictureYOffset: number;
};

type BlockGeometry = {
    readonly macroblockCount: number;
    readonly lumaBlockCount: number;
    readonly lumaBlockWidth: number;
    readonly lumaBlockHeight: number;
    readonly superblockCount: number;
    readonly blockCount: number;
    readonly chromaBlockCount: number;
    readonly chromaBlockWidth: number;
    readonly chromaBlockHeight: number;
};

type Timing = {
    readonly frameRateNumerator: number;
    readonly frameRateDenominator: number;
    readonly pixelAspectNumerator: number;
    readonly pixelAspectDenominator: number;
};

type StreamFlags = {
    readonly qualityHint: number;
    readonly keyFrameShift: number;
    readonly pixelFormat: PixelFormat;
};

export type Identification = BlockGeometry & PictureDimensions & StreamFlags & Timing & {
    readonly versionMajor: number;
    readonly versionMinor: number;
    readonly versionRevision: number;
    readonly colorSpace: number;
    readonly nominalBitrate: number;
};

function readPixelFormat(value: number): PixelFormat {
    if (value === 0) {
        return value;
    }
    if (value === CHROMA_422) {
        return value;
    }
    if (value === CHROMA_444) {
        return value;
    }
    throw new TheoraError('Unknown pixel format.', {});
}

function readFlags(packet: Packet): StreamFlags {
    const value = packet.next16();
    if (maskBits(value, RESERVED_MASK) !== 0) {
        throw new TheoraError('Invalid theora header', {});
    }
    return {
        qualityHint: shiftSignedRight(value, QUALITY_SHIFT),
        keyFrameShift: maskBits(shiftSignedRight(value, KEY_FRAME_SHIFT), KEY_FRAME_MASK),
        pixelFormat: readPixelFormat(maskBits(shiftSignedRight(value, PIXEL_FORMAT_SHIFT), PIXEL_FORMAT_MASK))
    };
}

function readPictureDimensions(packet: Packet): PictureDimensions {
    return {
        frameMacroblockWidth: packet.next16(),
        frameMacroblockHeight: packet.next16(),
        pictureWidth: packet.next24(),
        pictureHeight: packet.next24(),
        pictureXOffset: packet.next8(),
        pictureYOffset: packet.next8()
    };
}

function readTiming(packet: Packet): Timing {
    return {
        frameRateNumerator: packet.next32(),
        frameRateDenominator: packet.next32(),
        pixelAspectNumerator: packet.next24(),
        pixelAspectDenominator: packet.next24()
    };
}

function blocksPerMacroblock(pixelFormat: PixelFormat): number {
    if (pixelFormat === 0) {
        return BLOCKS_PER_420_MACROBLOCK;
    }
    return pixelFormat === CHROMA_422 ? BLOCKS_PER_422_MACROBLOCK : BLOCKS_PER_444_MACROBLOCK;
}

function computeChromaGeometry(
    dimensions: FrameDimensions,
    pixelFormat: PixelFormat
): Pick<
    BlockGeometry,
    'blockCount' | 'chromaBlockCount' | 'chromaBlockHeight' | 'chromaBlockWidth' | 'superblockCount'
> {
    const width = dimensions.frameMacroblockWidth;
    const height = dimensions.frameMacroblockHeight;
    const lumaSuperblocks = Math.trunc((width + 1) / BLOCKS_PER_MACROBLOCK_EDGE) *
        Math.trunc((height + 1) / BLOCKS_PER_MACROBLOCK_EDGE);
    const chromaWidth = pixelFormat === CHROMA_444 ? BLOCKS_PER_MACROBLOCK_EDGE * width : width;
    const chromaHeight = pixelFormat === 0 ? height : BLOCKS_PER_MACROBLOCK_EDGE * height;
    const chromaSuperblocks = Math.trunc((chromaWidth + SUPERBLOCK_ROUNDING) / BLOCKS_PER_SUPERBLOCK_EDGE) *
        Math.trunc((chromaHeight + SUPERBLOCK_ROUNDING) / BLOCKS_PER_SUPERBLOCK_EDGE);
    return {
        superblockCount: pixelFormat === CHROMA_444
            ? FULL_PLANES * lumaSuperblocks
            : lumaSuperblocks + CHROMA_PLANES * chromaSuperblocks,
        blockCount: blocksPerMacroblock(pixelFormat) * width * height,
        chromaBlockCount: chromaWidth * chromaHeight,
        chromaBlockWidth: chromaWidth,
        chromaBlockHeight: chromaHeight
    };
}

function computeBlockGeometry(dimensions: FrameDimensions, pixelFormat: PixelFormat): BlockGeometry {
    const macroblockCount = dimensions.frameMacroblockWidth * dimensions.frameMacroblockHeight;
    return {
        ...computeChromaGeometry(dimensions, pixelFormat),
        macroblockCount,
        lumaBlockCount: BLOCKS_PER_LUMA_MACROBLOCK * macroblockCount,
        lumaBlockWidth: BLOCKS_PER_MACROBLOCK_EDGE * dimensions.frameMacroblockWidth,
        lumaBlockHeight: BLOCKS_PER_MACROBLOCK_EDGE * dimensions.frameMacroblockHeight
    };
}

export function readIdentification(packet: Packet): Identification {
    beginHeader(packet, IDENTIFICATION_TYPE, 'Invalid identification header.');
    const version = { versionMajor: packet.next8(), versionMinor: packet.next8(), versionRevision: packet.next8() };
    const dimensions = readPictureDimensions(packet);
    const timing = readTiming(packet);
    const colorSpace = packet.next8();
    const nominalBitrate = packet.next24();
    const flags = readFlags(packet);
    return {
        ...version,
        ...dimensions,
        ...timing,
        colorSpace,
        nominalBitrate,
        ...flags,
        ...computeBlockGeometry(dimensions, flags.pixelFormat)
    };
}
