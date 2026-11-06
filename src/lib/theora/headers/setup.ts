import type { Packet } from '../../ogg/packet.ts';
import { TheoraError } from '../errors.ts';
import { type Bitstream as PacketBits, createBitstream } from '../packet-bits.ts';

import { readCoefficientCodebooks } from './huffman.ts';
import { beginHeader } from './protocol.ts';
import { type Quantization, readQuantization } from './quantization.ts';

const SETUP_HEADER_TYPE = 0x82;
const HEADER_PREFIX_BYTES = 7;
const QUALITY_LEVELS = 64;
const FILTER_LIMIT_LENGTH_BITS = 3;

export type SetupHeader = {
    readonly quantization: Quantization;
    readonly loopFilterLimit: (quality: number) => number;
    readonly readCoefficientSymbol: (table: number, reader: PacketBits) => number;
};

function readLoopLimits(reader: PacketBits): (quality: number) => number {
    const bits = reader.nextBits(FILTER_LIMIT_LENGTH_BITS);
    const limits = new Uint8Array(Array.from({ length: QUALITY_LEVELS }, function () {
        return reader.nextBits(bits);
    }));
    const data = new DataView(limits.buffer);
    return function (quality) {
        return data.getUint8(quality);
    };
}

export function readSetupHeader(packet: Packet): SetupHeader {
    beginHeader(packet, SETUP_HEADER_TYPE, 'Invalid setup header.');
    const reader = createBitstream(packet, HEADER_PREFIX_BYTES);
    const loopFilterLimit = readLoopLimits(reader);
    const quantization = readQuantization(reader);
    const codebooks = readCoefficientCodebooks(reader);
    return {
        loopFilterLimit,
        quantization,
        readCoefficientSymbol(table: number, input: PacketBits): number {
            const codebook = codebooks[table];
            if (codebook === undefined) {
                throw new TheoraError('Missing coefficient codebook.', {});
            }
            return codebook.read(input);
        }
    };
}
