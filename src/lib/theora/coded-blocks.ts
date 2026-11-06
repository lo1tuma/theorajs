import { LONG_RUN_LENGTH_HUFFMAN_TABLE, SHORT_RUN_LENGTH_HUFFMAN_TABLE } from './constants.ts';
import type { FrameMappings } from './frame-mappings.ts';
import type { Header } from './header.ts';
import type { Bitstream } from './packet-bits.ts';
import { readRunLengthBits } from './run-length-bits.ts';

export type CodedBlocks = { readonly flags: readonly number[]; readonly coded: readonly number[]; };

function expandCompleteFlags(partial: DataView, encoded: DataView): DataView {
    const result = new Uint8Array(partial.byteLength);
    let position = 0;
    const unmarked = Array
        .from({ length: partial.byteLength }, function (_value, index) {
            return index;
        })
        .filter(function (index) {
            return partial.getUint8(index) === 0;
        });
    for (const index of unmarked) {
        result[index] = encoded.getUint8(position);
        position += 1;
    }
    return new DataView(result.buffer);
}

function countPartialBlocks(partial: DataView, mappings: FrameMappings): number {
    let count = 0;
    for (let index = 0; index < partial.byteLength; index += 1) {
        if (partial.getUint8(index) === 1) {
            count += mappings.superBlockSize(index);
        }
    }
    return count;
}

function readInterFlags(reader: Bitstream, header: Header, mappings: FrameMappings): readonly number[] {
    const partial = readRunLengthBits(reader, header.superblockCount, LONG_RUN_LENGTH_HUFFMAN_TABLE);
    const completeCount = Array
        .from({ length: partial.byteLength }, function (_value, index) {
            return partial.getUint8(index);
        })
        .filter(function (flag) {
            return flag === 0;
        })
        .length;
    const complete = expandCompleteFlags(
        partial,
        readRunLengthBits(reader, completeCount, LONG_RUN_LENGTH_HUFFMAN_TABLE)
    );
    const coded = readRunLengthBits(reader, countPartialBlocks(partial, mappings), SHORT_RUN_LENGTH_HUFFMAN_TABLE);
    let position = 0;
    return Array.from({ length: header.blockCount }, function (_value, block) {
        const superblock = mappings.blockToSuperblock(block);
        if (partial.getUint8(superblock) === 0) {
            return complete.getUint8(superblock);
        }
        const flag = coded.getUint8(position);
        position += 1;
        return flag;
    });
}

export function readCodedBlocks(
    reader: Bitstream,
    header: Header,
    mappings: FrameMappings,
    frameType: number
): CodedBlocks {
    const flags = frameType === 0
        ? Array.from({ length: header.blockCount }, function () {
            return 1;
        })
        : readInterFlags(reader, header, mappings);
    return {
        flags,
        coded: Array.from(flags.keys()).filter(function (index) {
            return flags[index] !== 0;
        })
    };
}
