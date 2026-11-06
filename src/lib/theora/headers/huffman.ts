import { TheoraError } from '../errors.ts';
import type { Bitstream } from '../packet-bits.ts';

const MAXIMUM_CODE_BITS = 32;
const COEFFICIENT_TOKENS = 32;
const COEFFICIENT_TOKEN_BITS = 5;
const COEFFICIENT_TABLES = 80;

export type CoefficientCodebook = {
    readonly read: (reader: Bitstream) => number;
};

function readCodebook(reader: Bitstream): CoefficientCodebook {
    type HuffmanNode = { readonly kind: 'branch'; readonly zero: HuffmanNode; readonly one: HuffmanNode; } | {
        readonly kind: 'leaf';
        readonly token: number;
    };
    let symbols = 0;

    function readTree(depth: number): HuffmanNode {
        if (depth > MAXIMUM_CODE_BITS) {
            throw new TheoraError('Stream undecodable.', {});
        }
        if (reader.nextBits(1) === 1) {
            if (symbols === COEFFICIENT_TOKENS) {
                throw new TheoraError('Stream undecodable.', {});
            }
            symbols += 1;
            return { kind: 'leaf', token: reader.nextBits(COEFFICIENT_TOKEN_BITS) };
        }
        return { kind: 'branch', zero: readTree(depth + 1), one: readTree(depth + 1) };
    }

    const tree = readTree(0);
    return {
        read(input: Bitstream): number {
            let node = tree;
            while (node.kind === 'branch') {
                node = input.nextBits(1) === 0 ? node.zero : node.one;
            }
            return node.token;
        }
    };
}

export function readCoefficientCodebooks(reader: Bitstream): readonly CoefficientCodebook[] {
    return Array.from({ length: COEFFICIENT_TABLES }, function () {
        return readCodebook(reader);
    });
}
