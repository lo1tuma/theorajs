import { readBlockModes } from './block-modes.ts';
import { readBlockQuantizers } from './block-quantization.ts';
import { type CodedBlocks, readCodedBlocks } from './coded-blocks.ts';

import type { Coefficients } from './coefficient-storage.ts';
import { readPredictedCoefficients } from './coefficient-decoding.ts';
import { type FrameCoding, readFrameCoding } from './frame-header.ts';

import type { FrameMappings } from './frame-mappings.ts';
import type { Header } from './header.ts';
import { type MotionVectors, readMotionVectors } from './motion-vectors.ts';

import type { Bitstream } from './packet-bits.ts';

export type FramePlan = {
    readonly coding: FrameCoding;
    readonly blocks: CodedBlocks;
    readonly modes: readonly number[];
    readonly motion: MotionVectors | null;
    readonly selectors: readonly number[];
    readonly coefficients: Coefficients;
};

export function readFramePlan(reader: Bitstream, header: Header, mappings: FrameMappings): FramePlan {
    const coding = readFrameCoding(reader);
    const blocks = readCodedBlocks(reader, header, mappings, coding.frameType);
    const modes = readBlockModes(reader, header.macroblockCount, blocks.flags, coding.frameType);
    const motion = coding.frameType === 0
        ? null
        : readMotionVectors(reader, header, mappings, { modes, flags: blocks.flags });
    const selectors = readBlockQuantizers(reader, blocks.flags, coding.quantizers.length);
    const coefficients = readPredictedCoefficients(
        reader,
        { header, mappings, modes, flags: blocks.flags },
        blocks.coded
    );
    return { coding, blocks, modes, motion, selectors, coefficients };
}
