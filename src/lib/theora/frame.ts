import type { Packet } from '../ogg/packet.ts';
import type { FrameMappings } from './frame-mappings.ts';
import { readFramePlan } from './frame-plan.ts';
import { createFramePlanes } from './frame-planes.ts';
import { type FrameReferences, type ReconstructedImage, reconstructFrame } from './frame-reconstruction.ts';

import type { Header } from './header.ts';
import { filterReconstructedFrame } from './loop-filter.ts';
import { createBitstream } from './packet-bits.ts';

export type Frame = ReconstructedImage & { readonly frameType: 0 | 1; };
export type FrameContext = {
    readonly header: Header;
    readonly mappings: FrameMappings;
    readonly references: FrameReferences;
};

export function decodeFrame(packet: Packet, context: FrameContext): Frame {
    if (packet.getLength() === 0) {
        return { ...createFramePlanes(context.header, context.references.previous), frameType: 1, changedPixels: [] };
    }
    const plan = readFramePlan(createBitstream(packet, 0), context.header, context.mappings);
    const frame = reconstructFrame({ ...context, plan });
    filterReconstructedFrame(frame, {
        header: context.header,
        flags: plan.blocks.flags,
        quality: plan.coding.quantizers[0]
    }, context.mappings);
    return { ...frame, frameType: plan.coding.frameType };
}
