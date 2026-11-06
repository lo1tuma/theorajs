import type { Packet } from '../ogg/packet.ts';
import { combineBits, maskBits, shiftSignedLeft, shiftUnsignedRight } from '../stream/integer-arithmetic.ts';
import { TheoraError } from './errors.ts';

const BYTE_BITS = 8;
const LOOKAHEAD_BITS = 16;
const LOOKAHEAD_BYTES = 2;
const LOOKAHEAD_MASK = 0xFF_FF;
const THREE_BYTE_BITS = 24;
const INTEGER_BITS = 32;

type Lookahead = { readonly value: number; readonly consumed: number; readonly exhausted: boolean; };

export type Bitstream = {
    readonly nextBits: (count: number) => number;
    readonly nextUBits: (count: number) => number;
};

function readLookahead(packet: Packet, offset: number): Lookahead {
    const remaining = packet.getLength() - offset;
    if (remaining >= LOOKAHEAD_BYTES) {
        return { value: packet.next16(), consumed: 0, exhausted: false };
    }
    return remaining === 1
        ? { value: shiftSignedLeft(packet.next8(), BYTE_BITS), consumed: BYTE_BITS, exhausted: true }
        : { value: 0, consumed: LOOKAHEAD_BITS, exhausted: true };
}

export function createBitstream(packet: Packet, offset: number): Bitstream {
    packet.seek(offset);
    const initial = readLookahead(packet, offset);
    let lookup = initial.value;
    let { consumed, exhausted } = initial;

    function refill(count: number): void {
        const boundary = BYTE_BITS - consumed;
        lookup = shiftSignedLeft(lookup, boundary);
        try {
            lookup = combineBits(lookup, packet.next8());
        } catch {
            exhausted = true;
        }
        lookup = shiftSignedLeft(lookup, count - boundary);
        consumed = count - boundary;
    }

    function readBits(count: number): number {
        const value = shiftUnsignedRight(lookup, LOOKAHEAD_BITS - count);
        if (!exhausted && consumed + count >= BYTE_BITS) {
            refill(count);
        } else {
            if (exhausted && count > LOOKAHEAD_BITS - consumed) {
                throw new TheoraError('Bitstream: End of Stream', {});
            }
            lookup = shiftSignedLeft(lookup, count);
            consumed += count;
        }
        lookup = maskBits(lookup, LOOKAHEAD_MASK);
        return value;
    }

    function nextBits(count: number): number {
        if (count <= BYTE_BITS) {
            return count === 0 ? 0 : readBits(count);
        }
        if (count <= LOOKAHEAD_BITS) {
            return combineBits(shiftSignedLeft(readBits(BYTE_BITS), count - BYTE_BITS), readBits(count - BYTE_BITS));
        }
        if (count <= THREE_BYTE_BITS) {
            return combineBits(
                combineBits(
                    shiftSignedLeft(readBits(BYTE_BITS), count - LOOKAHEAD_BITS),
                    shiftSignedLeft(readBits(BYTE_BITS), count - BYTE_BITS)
                ),
                readBits(count - LOOKAHEAD_BITS)
            );
        }
        if (count <= INTEGER_BITS) {
            return combineBits(
                combineBits(
                    combineBits(
                        shiftSignedLeft(readBits(BYTE_BITS), count - THREE_BYTE_BITS),
                        shiftSignedLeft(readBits(BYTE_BITS), count - LOOKAHEAD_BITS)
                    ),
                    shiftSignedLeft(readBits(BYTE_BITS), count - BYTE_BITS)
                ),
                readBits(count - THREE_BYTE_BITS)
            );
        }
        throw new TheoraError('Bitstream can only read 0-32 bits at one time.', {});
    }

    return {
        nextBits,
        nextUBits(count) {
            return Math.abs(nextBits(count));
        }
    };
}
