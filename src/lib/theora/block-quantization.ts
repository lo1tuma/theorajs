import { LONG_RUN_LENGTH_HUFFMAN_TABLE } from './constants.ts';
import type { Bitstream } from './packet-bits.ts';
import { readRunLengthBits } from './run-length-bits.ts';

export function readBlockQuantizers(reader: Bitstream, flags: readonly number[], count: number): readonly number[] {
    const selectors = new DataView(new ArrayBuffer(flags.length));
    for (let choice = 0; choice < count - 1; choice += 1) {
        const candidates = Array.from(flags.keys()).filter(function (index) {
            return flags[index] !== 0 && selectors.getUint8(index) === choice;
        });
        const bits = readRunLengthBits(reader, candidates.length, LONG_RUN_LENGTH_HUFFMAN_TABLE);
        candidates.forEach(function (block, index) {
            selectors.setUint8(block, selectors.getUint8(block) + bits.getUint8(index));
        });
    }
    return Array.from({ length: flags.length }, function (_value, index) {
        return selectors.getUint8(index);
    });
}
