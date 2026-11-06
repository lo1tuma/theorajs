import { OggError } from './errors.ts';
import { type LogicalPageCursor, createLogicalPageCursor } from './logical-page-cursor.ts';

import { type Packet, createPacket } from './packet.ts';

import type { Page } from './page.ts';
import type { TransportStream } from './transportStream.ts';

const CONTINUED_SEGMENT_LENGTH = 255;

export type LogicalStream = LogicalPageCursor & {
    readonly serialNumber: number;
    readonly getFirstPacket: () => Packet | false;
    readonly nextPacket: () => Packet | false;
};

function appendSegments(packet: Packet, firstSegment: Uint8Array, cursor: LogicalPageCursor): void {
    let segment = firstSegment;
    while (segment.length === CONTINUED_SEGMENT_LENGTH) {
        packet.addSegment(segment);
        const continuation = cursor.nextSegment(true);
        if (continuation === false) {
            throw new OggError('Missing EndOfPacket segment', {});
        }
        segment = continuation;
    }
    packet.addSegment(segment);
}

function readPacket(cursor: LogicalPageCursor): Packet | false {
    const segment = cursor.nextSegment(false);
    if (segment === false) {
        return false;
    }
    const packet = createPacket();
    appendSegments(packet, segment, cursor);
    return packet;
}

export function createLogicalStream(stream: TransportStream, firstPage: Page): LogicalStream {
    const cursor = createLogicalPageCursor(stream, firstPage);
    let firstPacket: Packet | false | null = null;
    let rereadFirstPacket = false;

    function nextPacket(): Packet | false {
        if (rereadFirstPacket && firstPacket !== null) {
            rereadFirstPacket = false;
            return firstPacket;
        }
        const packet = readPacket(cursor);
        if (firstPacket === null && packet !== false) {
            firstPacket = packet;
        }
        return packet;
    }

    return {
        ...cursor,
        serialNumber: firstPage.serialNumber,
        nextPacket,
        getFirstPacket(): Packet | false {
            if (firstPacket === null) {
                firstPacket = nextPacket();
                rereadFirstPacket = true;
            }
            return firstPacket;
        }
    };
}
