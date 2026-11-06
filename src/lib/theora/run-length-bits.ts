import type { HuffmanRunLength, HuffmanTable } from './constants.ts';
import { TheoraError } from './errors.ts';
import { readHuffmanToken } from './huffman-codes.ts';
import type { Bitstream } from './packet-bits.ts';

const MAXIMUM_RUN = 4129;

function appendRun(target: Uint8Array, position: number, length: number, value: number): number {
    const end = position + length;
    if (end > target.length) {
        throw new TheoraError('Invalid stream.', {});
    }
    target.fill(value, position, end);
    return end;
}

export function readRunLengthBits(reader: Bitstream, count: number, table: HuffmanTable<HuffmanRunLength>): DataView {
    const bits = new Uint8Array(count);
    let position = 0;
    let value = count === 0 ? 0 : reader.nextBits(1);
    while (position < count) {
        const code = readHuffmanToken(reader, table);
        const length = code.start + reader.nextBits(code.extraBits);
        position = appendRun(bits, position, length, value);
        if (position < count) {
            value = length === MAXIMUM_RUN ? reader.nextBits(1) : 1 - value;
        }
    }
    return new DataView(bits.buffer);
}
