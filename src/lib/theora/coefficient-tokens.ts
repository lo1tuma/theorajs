import specifications from './coefficient-tokens.json' with { type: 'json' };
import { TheoraError } from './errors.ts';
import type { Bitstream } from './packet-bits.ts';

const FIRST_VALUE_TOKEN = 7;

export type CoefficientRun = { readonly zeros: number; readonly value: number | null; };

export function readCoefficientRun(reader: Bitstream, token: number): CoefficientRun {
    const specification = specifications.values[token - FIRST_VALUE_TOKEN];
    if (specification === undefined) {
        throw new TheoraError('Unable to decode stream: invalid frame packet.', {});
    }
    if (!specification.signed) {
        return {
            zeros: specification.zeroBase + reader.nextBits(specification.zeroBits),
            value: specification.literal
        };
    }
    const negative = reader.nextBits(1) === 1;
    const magnitude = specification.magnitudeBase + reader.nextBits(specification.magnitudeBits);
    const zeros = specification.zeroBase + reader.nextBits(specification.zeroBits);
    return { zeros, value: negative ? -magnitude : magnitude };
}

export function readEndRun(reader: Bitstream, token: number, remainder: () => number): number {
    const specification = specifications.ends[token];
    if (specification === undefined) {
        throw new TheoraError('Unable to decode stream: invalid frame packet.', {});
    }
    const count = specification.base + reader.nextBits(specification.bits);
    return count === 0 && specification.remainder ? remainder() : count;
}
