import type { ByteStream, Integer64 } from '../stream/byteStream.ts';
import { maskBits } from '../stream/integer-arithmetic.ts';
import { OggError } from './errors.ts';

const FIXED_HEADER_BYTES = 27;
const CONTINUED_FLAG = 1;
const BEGIN_FLAG = 2;
const END_FLAG = 4;

type PageHeader = {
    readonly capturePattern: string;
    readonly version: number;
    readonly headerType: number;
    readonly granulePosition: Integer64;
    readonly serialNumber: number;
    readonly pageSequenceNumber: number;
    readonly checksum: number;
    readonly pageSegments: number;
};

export type Page = {
    readonly segmentTable: readonly number[];
    readonly segments: readonly Uint8Array<ArrayBuffer>[];
    readonly headerLength: number;
    readonly bodyLength: number;
    readonly isValid: () => boolean;
    readonly isContinuedPage: () => boolean;
    readonly isBeginOfStream: () => boolean;
    readonly isEndOfStream: () => boolean;
} & PageHeader;

function readHeader(stream: ByteStream): PageHeader {
    const capturePattern = String.fromCodePoint(stream.next8(), stream.next8(), stream.next8(), stream.next8());
    if (capturePattern !== 'OggS') {
        throw new OggError('Page has invalid capturePattern.', {});
    }
    return {
        capturePattern,
        version: stream.next8(),
        headerType: stream.next8(),
        granulePosition: stream.next64(true),
        serialNumber: stream.next32(true),
        pageSequenceNumber: stream.next32(true),
        checksum: stream.next32(true),
        pageSegments: stream.next8()
    };
}

export function readPage(stream: ByteStream): Page {
    const header = readHeader(stream);
    const segmentTable = Array.from({ length: header.pageSegments }, function () {
        return stream.next8();
    });
    const segments = segmentTable.map(function (length) {
        return stream.nextArray(length);
    });
    const bodyLength = segmentTable.reduce(function (total, length) {
        return total + length;
    }, 0);
    return {
        ...header,
        segmentTable,
        segments,
        bodyLength,
        headerLength: FIXED_HEADER_BYTES + header.pageSegments,
        isValid() {
            return header.capturePattern === 'OggS';
        },
        isContinuedPage() {
            return maskBits(header.headerType, CONTINUED_FLAG) === CONTINUED_FLAG;
        },
        isBeginOfStream() {
            return maskBits(header.headerType, BEGIN_FLAG) === BEGIN_FLAG;
        },
        isEndOfStream() {
            return maskBits(header.headerType, END_FLAG) === END_FLAG;
        }
    };
}
