import test from 'ava';
import { createLogicalStream } from '../../../../src/lib/ogg/logicalStream.ts';
import type { Packet } from '../../../../src/lib/ogg/packet.ts';
import type { Page } from '../../../../src/lib/ogg/page.ts';
import type { TransportStream } from '../../../../src/lib/ogg/transportStream.ts';

type PageOverrides = {
    readonly beginOfStream?: boolean;
    readonly serialNumber?: number;
    readonly segments?: readonly Uint8Array<ArrayBuffer>[];
    readonly continued?: boolean;
    readonly endOfStream?: boolean;
    readonly pageSequenceNumber?: number;
};

const DEFAULT_PAGE = {
    beginOfStream: false,
    serialNumber: 0,
    segments: [],
    continued: false,
    endOfStream: true,
    pageSequenceNumber: 0
};

function createPage(overrides: PageOverrides): Page {
    const { beginOfStream, serialNumber, segments, continued, endOfStream, pageSequenceNumber } = {
        ...DEFAULT_PAGE,
        ...overrides
    };
    const segmentTable = segments.map(function (segment) {
        return segment.length;
    });
    return {
        isBeginOfStream() {
            return beginOfStream;
        },
        isEndOfStream() {
            return endOfStream;
        },
        isContinuedPage() {
            return continued;
        },
        isValid() {
            return true;
        },
        capturePattern: 'OggS',
        version: 0,
        headerType: 0,
        granulePosition: { lowBits: 0, highBits: 0 },
        checksum: 0,
        headerLength: 27 + segments.length,
        bodyLength: segmentTable.reduce(function (total, length) {
            return total + length;
        }, 0),
        pageSegments: segments.length,
        segments,
        segmentTable,
        serialNumber,
        pageSequenceNumber
    };
}

function createTransportStream(secondPage: Page | false): TransportStream {
    return {
        nextPage() {
            if (secondPage === false) {
                throw new Error('No next page available.');
            }
            return secondPage;
        },
        findLogicalStreams() {
            return [];
        }
    };
}

function createSegment(length: number): Uint8Array<ArrayBuffer> {
    return new Uint8Array(length);
}

function requirePacket(packet: Packet | false): Packet {
    if (packet === false) {
        throw new Error('Missing packet.');
    }
    return packet;
}

test('throws when the given page is not the first page of the logical stream', function (t) {
    const transportStream = createTransportStream(false);
    const page = createPage({ beginOfStream: false });

    t.throws(function () {
        return createLogicalStream(transportStream, page);
    }, {
        name: 'OggError',
        message: 'LogicalStream must be initialized with a BeginOfStream page.'
    });
});

test('doesn’t throw when the given page is the first page of the logical stream', function (t) {
    const transportStream = createTransportStream(false);
    const page = createPage({ beginOfStream: true });

    t.notThrows(function () {
        return createLogicalStream(transportStream, page);
    });
});

test('exposes the serial number of the first page', function (t) {
    const transportStream = createTransportStream(false);
    const page = createPage({ beginOfStream: true, serialNumber: 42 });
    const logicalStream = createLogicalStream(transportStream, page);

    t.is(logicalStream.serialNumber, 42);
});

test('nextPacket() returns a Packet when one packet segments are in a single page', function (t) {
    const transportStream = createTransportStream(false);
    const segments = [ createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = createLogicalStream(transportStream, page);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is(requirePacket(packet).getLength(), 1);
});

test('nextPacket() returns a Packet when multiple packet segments are in a single page', function (t) {
    const transportStream = createTransportStream(false);
    const segments = [ createSegment(255), createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = createLogicalStream(transportStream, page);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is(requirePacket(packet).getLength(), 256);
});

test('nextPacket() returns the second Packet on the second call when two packets are in the same page', function (t) {
    const transportStream = createTransportStream(false);
    const segments = [ createSegment(1), createSegment(2) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = createLogicalStream(transportStream, page);

    const firstPacket = logicalStream.nextPacket();
    const secondPacket = logicalStream.nextPacket();

    t.not(firstPacket, false);
    t.is(requirePacket(firstPacket).getLength(), 1);

    t.not(secondPacket, false);
    t.is(requirePacket(secondPacket).getLength(), 2);
});

test('nextPacket() returns false when the end of stream has been reached already', function (t) {
    const transportStream = createTransportStream(false);
    const segments = [ createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = createLogicalStream(transportStream, page);

    const firstPacket = logicalStream.nextPacket();
    const secondPacket = logicalStream.nextPacket();

    t.not(firstPacket, false);
    t.is(requirePacket(firstPacket).getLength(), 1);

    t.false(secondPacket);
});

test('nextPacket() throws when the end of stream has been reached but the end of packet not', function (t) {
    const transportStream = createTransportStream(false);
    const segments = [ createSegment(1), createSegment(255) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = createLogicalStream(transportStream, page);

    logicalStream.nextPacket();
    t.throws(function () {
        return logicalStream.nextPacket();
    }, { message: 'Missing EndOfPacket segment', name: 'OggError' });
});

test('nextPacket() returns a Packet which spans over multiple pages', function (t) {
    const firstPageSegments = [ createSegment(255) ];
    const firstPage = createPage({
        beginOfStream: true,
        segments: firstPageSegments,
        endOfStream: false,
        pageSequenceNumber: 1
    });
    const secondPageSegments = [ createSegment(1) ];
    const secondPage = createPage({
        beginOfStream: false,
        continued: true,
        segments: secondPageSegments,
        pageSequenceNumber: 2
    });
    const transportStream = createTransportStream(secondPage);
    const logicalStream = createLogicalStream(transportStream, firstPage);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is(requirePacket(packet).getLength(), 256);
});

test('nextPacket() throws an error when a missing page was detected', function (t) {
    const firstPageSegments = [ createSegment(1) ];
    const firstPage = createPage({
        beginOfStream: true,
        segments: firstPageSegments,
        endOfStream: false,
        pageSequenceNumber: 1
    });
    const secondPageSegments = [ createSegment(1) ];
    const secondPage = createPage({
        beginOfStream: false,
        continued: true,
        segments: secondPageSegments,
        pageSequenceNumber: 3
    });
    const transportStream = createTransportStream(secondPage);
    const logicalStream = createLogicalStream(transportStream, firstPage);

    logicalStream.nextPacket();
    t.throws(function () {
        return logicalStream.nextPacket();
    }, { name: 'OggError', message: 'Lost data; missing page.' });
});

test(
    'nextPacket() throws an error when a Packet spans over multiple pages but the second page is not a continued page',
    function (t) {
        const firstPageSegments = [ createSegment(255) ];
        const firstPage = createPage({
            beginOfStream: true,
            segments: firstPageSegments,
            endOfStream: false,
            pageSequenceNumber: 1
        });
        const secondPageSegments = [ createSegment(1) ];
        const secondPage = createPage({
            beginOfStream: false,
            continued: false,
            segments: secondPageSegments,
            pageSequenceNumber: 2
        });
        const transportStream = createTransportStream(secondPage);
        const logicalStream = createLogicalStream(transportStream, firstPage);

        t.throws(function () {
            return logicalStream.nextPacket();
        }, { name: 'OggError', message: 'Page is not a continued page.' });
    }
);
