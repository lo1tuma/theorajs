import { TheoraError } from './errors.ts';
import type { Bitstream } from './packet-bits.ts';

const MAXIMUM_QUANTIZERS = 3;
const QUALITY_BITS = 6;
const INTRA_RESERVED_BITS = 3;

type Quantizers = readonly [first: number, ...additional: number[]];
export type FrameCoding = { readonly frameType: 0 | 1; readonly quantizers: Quantizers; };

function readQuantizers(reader: Bitstream): Quantizers {
    const first = reader.nextBits(QUALITY_BITS);
    const additional: number[] = [];
    let more = reader.nextBits(1);
    while (more === 1 && additional.length < MAXIMUM_QUANTIZERS - 1) {
        additional.push(reader.nextBits(QUALITY_BITS));
        if (additional.length < MAXIMUM_QUANTIZERS - 1) {
            more = reader.nextBits(1);
        }
    }
    return [ first, ...additional ];
}

export function readFrameCoding(reader: Bitstream): FrameCoding {
    if (reader.nextBits(1) !== 0) {
        throw new TheoraError('Unable to decode stream: invalid frame packet.', {});
    }
    const frameType = reader.nextBits(1) === 0 ? 0 : 1;
    const quantizers = readQuantizers(reader);
    if (frameType === 0 && reader.nextBits(INTRA_RESERVED_BITS) !== 0) {
        throw new TheoraError('Unable to decode stream: used reserved bits.', {});
    }
    return { frameType, quantizers };
}
