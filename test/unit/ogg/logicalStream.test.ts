import test from 'ava';
import { LogicalStream } from '../../../src/ogg/logicalStream';
import { TransportStream } from '../../../src/ogg/transportStream';
import { Page } from '../../../src/ogg/page';
import { Packet } from '../../../src/ogg/packet';

interface PageOverrides {
    beginOfStream?: boolean;
    serialNumber?: number;
    segments?: number[][];
    continued?: boolean;
    endOfStream?: boolean;
    pageSequenceNumber?: number;
}

function createPage(overrides: PageOverrides = {}): Page {
    const {
        beginOfStream = false,
        serialNumber = 0,
        segments = [],
        continued = false,
        endOfStream = true,
        pageSequenceNumber = 0
    } = overrides;

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
        pageSegments: segments.length,
        segments,
        serialNumber,
        pageSequenceNumber
    } as unknown as Page;

}

interface TransportStreamOverrides {
    secondPage?: false | Page
}

function createTransportStream(overrides: TransportStreamOverrides = {}) {
    const {
        secondPage = false
    } = overrides;

    return {
        nextPage() {
            return secondPage;
        }
    } as unknown as TransportStream;
}

function createSegment(length: number) {
    return Array(length).fill(0);
}

test('throws when the given page is not the first page of the logical stream', (t) => {
    const transportStream = createTransportStream();
    const page = createPage({ beginOfStream: false });

    t.throws(() => new LogicalStream(transportStream, page), {
        name: 'OggError',
        message: 'LogicalStream must be initialized with a BeginOfStream page.'
    });
});

test('doesn’t throw when the given page is the first page of the logical stream', (t) => {
    const transportStream = createTransportStream();
    const page = createPage({ beginOfStream: true });

    t.notThrows(() => new LogicalStream(transportStream, page));
});

test('exposes the serial number of the first page', (t) => {
    const transportStream = createTransportStream();
    const page = createPage({ beginOfStream: true, serialNumber: 42 });
    const logicalStream = new LogicalStream(transportStream, page);

    t.is(logicalStream.serialNumber, 42);
});

test('nextPacket() returns a Packet when one packet segments are in a single page', (t) => {
    const transportStream = createTransportStream();
    const segments = [ createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = new LogicalStream(transportStream, page);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is((packet as Packet).getLength(), 1);
});

test('nextPacket() returns a Packet when multiple packet segments are in a single page', (t) => {
    const transportStream = createTransportStream();
    const segments = [ createSegment(255), createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = new LogicalStream(transportStream, page);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is((packet as Packet).getLength(), 256);
});

test('nextPacket() returns the second Packet on the second call when two packets are in the same page', (t) => {
    const transportStream = createTransportStream();
    const segments = [ createSegment(1), createSegment(2) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = new LogicalStream(transportStream, page);

    const firstPacket = logicalStream.nextPacket();
    const secondPacket = logicalStream.nextPacket();

    t.not(firstPacket, false);
    t.is((firstPacket as Packet).getLength(), 1);

    t.not(secondPacket, false);
    t.is((secondPacket as Packet).getLength(), 2);
});

test('nextPacket() returns false when the end of stream has been reached already', (t) => {
    const transportStream = createTransportStream({ secondPage: false });
    const segments = [ createSegment(1) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = new LogicalStream(transportStream, page);

    const firstPacket = logicalStream.nextPacket();
    const secondPacket = logicalStream.nextPacket();

    t.not(firstPacket, false);
    t.is((firstPacket as Packet).getLength(), 1);

    t.is(secondPacket, false);
});

test('nextPacket() throws when the end of stream has been reached but the end of packet not', (t) => {
    const transportStream = createTransportStream({ secondPage: false });
    const segments = [ createSegment(1), createSegment(255) ];
    const page = createPage({ beginOfStream: true, segments });
    const logicalStream = new LogicalStream(transportStream, page);

    logicalStream.nextPacket();
    t.throws(() => logicalStream.nextPacket(), { message: 'Missing EndOfPacket segment', name: 'OggError' });
});

test('nextPacket() returns a Packet which spans over multiple pages', (t) => {
    const firstPageSegments = [ createSegment(255) ];
    const firstPage = createPage({ beginOfStream: true, segments: firstPageSegments, endOfStream: false, pageSequenceNumber: 1 });
    const secondPageSegments = [ createSegment(1) ];
    const secondPage = createPage({ beginOfStream: false, continued: true, segments: secondPageSegments, pageSequenceNumber: 2 });
    const transportStream = createTransportStream({ secondPage });
    const logicalStream = new LogicalStream(transportStream, firstPage);

    const packet = logicalStream.nextPacket();

    t.not(packet, false);
    t.is((packet as Packet).getLength(), 256);
});

test('nextPacket() throws an error when a missing page was detected', (t) => {
    const firstPageSegments = [ createSegment(1) ];
    const firstPage = createPage({ beginOfStream: true, segments: firstPageSegments, endOfStream: false, pageSequenceNumber: 1 });
    const secondPageSegments = [ createSegment(1) ];
    const secondPage = createPage({ beginOfStream: false, continued: true, segments: secondPageSegments, pageSequenceNumber: 3 });
    const transportStream = createTransportStream({ secondPage });
    const logicalStream = new LogicalStream(transportStream, firstPage);

    logicalStream.nextPacket();
    t.throws(() => logicalStream.nextPacket(), { name: 'OggError', message: 'Lost data; mising page.' });
});

test('nextPacket() throws an error when a Packet spans over multiple pages but the second page is not a continued page', (t) => {
    const firstPageSegments = [ createSegment(255) ];
    const firstPage = createPage({ beginOfStream: true, segments: firstPageSegments, endOfStream: false, pageSequenceNumber: 1 });
    const secondPageSegments = [ createSegment(1) ];
    const secondPage = createPage({ beginOfStream: false, continued: false, segments: secondPageSegments, pageSequenceNumber: 2 });
    const transportStream = createTransportStream({ secondPage });
    const logicalStream = new LogicalStream(transportStream, firstPage);

    logicalStream.nextPacket();
    t.throws(() => logicalStream.nextPacket(), { name: 'OggError', message: 'Page is not a continued page.' });
});

