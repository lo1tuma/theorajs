import { shiftSignedLeft } from '../stream/integer-arithmetic.ts';
import type { HuffmanTable } from './constants.ts';
import { TheoraError } from './errors.ts';
import type { Bitstream } from './packet-bits.ts';

export function readHuffmanToken<T>(reader: Bitstream, table: HuffmanTable<T>): T {
    let code = 0;
    for (const [ depth, offset ] of table.offsets.entries()) {
        code += reader.nextBits(1);
        const token = table.codes[depth]?.[code - offset];
        if (token !== undefined) {
            return token;
        }
        code = shiftSignedLeft(code, 1);
    }
    throw new TheoraError('Invalid Huffman code.', {});
}
