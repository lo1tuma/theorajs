import type { LogicalStream } from '../ogg/logicalStream.ts';
import { createFrameMappings } from './frame-mappings.ts';
import { decodeFrame, type Frame } from './frame.ts';
import { type Header, readTheoraHeaders } from './header.ts';

export type Decoder = {
    readonly width: number;
    readonly height: number;
    readonly bitrate: number;
    readonly comments: Header['comments'];
    readonly vendor: string;
    readonly framerate: number;
    readonly pixelFormat: number;
    readonly xOffset: number;
    readonly yOffset: number;
    readonly nextFrame: () => Frame | false;
};

export function createDecoder(stream: LogicalStream): Decoder {
    const header = readTheoraHeaders(stream);
    const mappings = createFrameMappings(header);
    let golden: Frame | null = null;
    let previous: Frame | null = null;
    return {
        width: header.pictureWidth,
        height: header.pictureHeight,
        bitrate: header.nominalBitrate,
        comments: header.comments,
        vendor: header.vendor,
        framerate: header.frameRateNumerator / header.frameRateDenominator,
        pixelFormat: header.pixelFormat,
        xOffset: header.pictureXOffset,
        yOffset: header.pictureYOffset,
        nextFrame(): Frame | false {
            const packet = stream.nextPacket();
            if (packet === false) {
                return false;
            }
            const frame = decodeFrame(packet, { header, mappings, references: { golden, previous } });
            if (frame.frameType === 0) {
                golden = frame;
            }
            previous = frame;
            return frame;
        }
    };
}
