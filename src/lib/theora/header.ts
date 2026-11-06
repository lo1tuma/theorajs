import type { LogicalStream } from '../ogg/logicalStream.ts';
import type { Packet } from '../ogg/packet.ts';
import { TheoraError } from './errors.ts';
import { type CommentHeader, readCommentHeader } from './headers/comments.ts';

import { type Identification, readIdentification } from './headers/identification.ts';

import { type SetupHeader, readSetupHeader } from './headers/setup.ts';

export type Header = CommentHeader & Identification & SetupHeader;

function requireHeaderPacket(stream: LogicalStream): Packet {
    const packet = stream.nextPacket();
    if (packet === false) {
        throw new TheoraError('Missing Theora header packet.', {});
    }
    return packet;
}

export function readTheoraHeaders(stream: LogicalStream): Header {
    const identification = readIdentification(requireHeaderPacket(stream));
    const comments = readCommentHeader(requireHeaderPacket(stream));
    const setup = readSetupHeader(requireHeaderPacket(stream));
    return { ...identification, ...comments, ...setup };
}
