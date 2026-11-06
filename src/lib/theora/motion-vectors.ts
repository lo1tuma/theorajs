import { MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE } from './constants.ts';
import { TheoraError } from './errors.ts';
import type { FrameMappings } from './frame-mappings.ts';
import type { Header } from './header.ts';
import { readHuffmanToken } from './huffman-codes.ts';
import { directionSign } from './integer-math.ts';
import type { Bitstream } from './packet-bits.ts';

const COMPONENT_BITS = 5;
const VECTOR_COMPONENTS = 2;
const LUMA_BLOCKS = 4;
const LUMA_PAIR = 2;
const CHROMA_422 = 2;
const EXPLICIT_MODE = 2;
const PREVIOUS_MODE = 3;
const SECOND_PREVIOUS_MODE = 4;
const GOLDEN_MODE = 6;
const FOUR_VECTOR_MODE = 7;
const ZERO_VECTOR: MotionVector = [ 0, 0 ];

export type MotionVector = readonly [horizontal: number, vertical: number];
export type MotionVectors = { readonly forBlock: (index: number) => MotionVector; };
type MotionGeometry = Pick<Header, 'blockCount' | 'macroblockCount' | 'pixelFormat'>;
type MotionCoding = { readonly modes: readonly number[]; readonly flags: readonly number[]; };
type MacroblockCoding = { readonly mode: number | undefined; readonly flags: readonly number[]; };
type MotionHistory = {
    readonly readVector: () => MotionVector;
    readonly selectVector: (mode: number) => MotionVector;
    readonly rememberVector: (vector: MotionVector) => void;
};

function readComponent(reader: Bitstream, codingMode: number): number {
    if (codingMode === 0) {
        return readHuffmanToken(reader, MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE);
    }
    const magnitude = reader.nextBits(COMPONENT_BITS);
    return reader.nextBits(1) === 1 ? -magnitude : magnitude;
}

function createMotionHistory(reader: Bitstream): MotionHistory {
    const codingMode = reader.nextBits(1);
    let previous = ZERO_VECTOR;
    let secondPrevious = ZERO_VECTOR;
    function readVector(): MotionVector {
        return [ readComponent(reader, codingMode), readComponent(reader, codingMode) ];
    }
    function rememberVector(vector: MotionVector): void {
        secondPrevious = previous;
        previous = vector;
    }
    function readAndRemember(): MotionVector {
        const vector = readVector();
        rememberVector(vector);
        return vector;
    }
    const operations: Readonly<Record<number, () => MotionVector>> = {
        [EXPLICIT_MODE]: readAndRemember,
        [PREVIOUS_MODE]() {
            return previous;
        },
        [SECOND_PREVIOUS_MODE]() {
            const vector = secondPrevious;
            rememberVector(vector);
            return vector;
        },
        [GOLDEN_MODE]: readVector
    };
    return {
        readVector,
        rememberVector,
        selectVector(mode) {
            return operations[mode]?.() ?? ZERO_VECTOR;
        }
    };
}

function roundVector(value: number): number {
    const magnitude = Math.round(Math.abs(value));
    return magnitude === 0 ? 0 : magnitude * directionSign(value);
}

function averageVectors(vectors: readonly MotionVector[]): MotionVector {
    if (vectors.length === 0) {
        throw new TheoraError('Missing luma motion vectors.', {});
    }
    const horizontal = vectors.reduce(function (sum, [ value ]) {
        return sum + value;
    }, 0);
    const vertical = vectors.reduce(function (sum, [ , value ]) {
        return sum + value;
    }, 0);
    return [ roundVector(horizontal / vectors.length), roundVector(vertical / vectors.length) ];
}

function chromaVectors(luma: readonly MotionVector[], pixelFormat: number): readonly MotionVector[] {
    if (pixelFormat === 0) {
        const average = averageVectors(luma);
        return [ average, average ];
    }
    if (pixelFormat === CHROMA_422) {
        const first = averageVectors(luma.slice(0, LUMA_PAIR));
        const second = averageVectors(luma.slice(LUMA_PAIR));
        return [ first, second, first, second ];
    }
    return [ ...luma, ...luma ];
}

function readFourVectors(
    history: MotionHistory,
    format: number,
    blocks: readonly number[],
    flags: readonly number[]
): ReadonlyMap<number, MotionVector> {
    const codedVectors: MotionVector[] = [];
    const luma = blocks.slice(0, LUMA_BLOCKS).map(function (block) {
        if (flags[block] === 0) {
            return ZERO_VECTOR;
        }
        const vector = history.readVector();
        codedVectors.push(vector);
        return vector;
    });
    const last = codedVectors.at(-1);
    if (last === undefined) {
        throw new TheoraError('Missing coded luma block.', {});
    }
    history.rememberVector(last);
    const vectors = [ ...luma, ...chromaVectors(luma, format) ];
    return new Map(blocks.map(function (block, index) {
        const vector = vectors[index];
        if (vector === undefined) {
            throw new TheoraError('Missing macroblock motion vector.', {});
        }
        return [ block, vector ] as const;
    }));
}

function readMacroblockVectors(
    history: MotionHistory,
    format: number,
    blocks: readonly number[],
    coding: MacroblockCoding
): ReadonlyMap<number, MotionVector> {
    if (coding.mode === undefined) {
        throw new TheoraError('Missing macroblock mode.', {});
    }
    if (coding.mode === FOUR_VECTOR_MODE) {
        return readFourVectors(history, format, blocks, coding.flags);
    }
    const vector = history.selectVector(coding.mode);
    return new Map(blocks.map(function (block) {
        return [ block, vector ] as const;
    }));
}

function writeVector(data: DataView, block: number, vector: MotionVector): void {
    const [ horizontal, vertical ] = vector;
    data.setInt8(block * VECTOR_COMPONENTS, horizontal);
    data.setInt8(block * VECTOR_COMPONENTS + 1, vertical);
}

export function readMotionVectors(
    reader: Bitstream,
    geometry: MotionGeometry,
    mappings: FrameMappings,
    coding: MotionCoding
): MotionVectors {
    const history = createMotionHistory(reader);
    const data = new DataView(new ArrayBuffer(geometry.blockCount * VECTOR_COMPONENTS));
    for (let macroblock = 0; macroblock < geometry.macroblockCount; macroblock += 1) {
        const vectors = readMacroblockVectors(history, geometry.pixelFormat, mappings.macroblockToBlocks(macroblock), {
            mode: coding.modes[macroblock],
            flags: coding.flags
        });
        for (const [ block, vector ] of vectors) {
            writeVector(data, block, vector);
        }
    }
    return {
        forBlock(index) {
            return [ data.getInt8(index * VECTOR_COMPONENTS), data.getInt8(index * VECTOR_COMPONENTS + 1) ];
        }
    };
}
