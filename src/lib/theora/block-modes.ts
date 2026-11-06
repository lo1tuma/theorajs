import { MACRO_BLOCK_MODE_SCHEMES, MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE } from './constants.ts';
import { TheoraError } from './errors.ts';
import { readHuffmanToken } from './huffman-codes.ts';
import type { Bitstream } from './packet-bits.ts';

const MODE_BITS = 3;
const MODE_COUNT = 8;
const DIRECT_SCHEME = 7;
const LUMA_BLOCKS_PER_MACROBLOCK = 4;

function readCustomAlphabet(reader: Bitstream): DataView {
    const alphabet: number[] = [];
    for (let mode = 0; mode < MODE_COUNT; mode += 1) {
        const index = reader.nextBits(MODE_BITS);
        if (alphabet[index] !== undefined) {
            throw new TheoraError('Invalid macroblock mode alphabet.', {});
        }
        alphabet[index] = mode;
    }
    const bytes = new Uint8Array(alphabet);
    return new DataView(bytes.buffer);
}

function readAlphabet(reader: Bitstream, scheme: number): DataView | null {
    if (scheme === DIRECT_SCHEME) {
        return null;
    }
    if (scheme === 0) {
        return readCustomAlphabet(reader);
    }
    const alphabet = MACRO_BLOCK_MODE_SCHEMES[scheme];
    if (alphabet === null || alphabet === undefined) {
        throw new TheoraError('Invalid macroblock mode scheme.', {});
    }
    const bytes = new Uint8Array(alphabet);
    return new DataView(bytes.buffer);
}

function readMode(reader: Bitstream, alphabet: DataView | null): number {
    return alphabet === null
        ? reader.nextBits(MODE_BITS)
        : alphabet.getUint8(readHuffmanToken(reader, MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE));
}

export function readBlockModes(
    reader: Bitstream,
    count: number,
    flags: readonly number[],
    frameType: number
): readonly number[] {
    if (frameType === 0) {
        return Array.from({ length: count }, function () {
            return 1;
        });
    }
    const alphabet = readAlphabet(reader, reader.nextBits(MODE_BITS));
    return Array.from({ length: count }, function (_value, macroblock) {
        const start = macroblock * LUMA_BLOCKS_PER_MACROBLOCK;
        const coded = flags.slice(start, start + LUMA_BLOCKS_PER_MACROBLOCK).includes(1);
        return coded ? readMode(reader, alphabet) : 0;
    });
}
