import test from 'ava';
import { createTransportStream } from '../../../../src/lib/ogg/transportStream.ts';
import { type ByteStream, createByteStream as createEmptyByteStream } from '../../../../src/lib/stream/byteStream.ts';

type PageDataOverrides = {
    readonly headerType?: number;
    readonly pageSequenceNumber?: readonly number[];
};

function createPageData(overrides: PageDataOverrides = {}): Uint8Array {
    const { headerType = 0, pageSequenceNumber = [ 0, 0, 0, 0 ] } = overrides;
    const granulePosition = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
    const serialNumber = [ 0, 0, 0, 0 ];
    const checksum = [ 0, 0, 0, 0 ];
    const data = [
        0,
        headerType,
        ...granulePosition,
        ...serialNumber,
        ...pageSequenceNumber,
        ...checksum,
        1,
        1,
        42
    ];

    const encoder = new TextEncoder();
    const capturePattern = encoder.encode('OggS');

    return new Uint8Array([ ...capturePattern, ...data ]);
}

function createByteStream(pages: readonly Uint8Array[]): ByteStream {
    const stream = createEmptyByteStream();
    const totalLength = pages.reduce(function (acc, page) {
        return acc + page.length;
    }, 0);
    const result = new Uint8Array(totalLength);
    let index = 0;

    for (const page of pages) {
        result.set(page, index);
        index += page.length;
    }

    stream.setData(result.buffer);

    return stream;
}

test('nextPage() returns the first Page instance on the first call', function (t) {
    const pageData = createPageData({ pageSequenceNumber: [ 1, 0, 0, 0 ] });
    const byteStream = createByteStream([ pageData ]);
    const transportStream = createTransportStream(byteStream);

    const page = transportStream.nextPage();

    t.is(page.pageSequenceNumber, 1);
});

test('nextPage() returns the second Page instance on the second call', function (t) {
    const firstPageData = createPageData({ pageSequenceNumber: [ 1, 0, 0, 0 ] });
    const secondPageData = createPageData({ pageSequenceNumber: [ 2, 0, 0, 0 ] });
    const byteStream = createByteStream([ firstPageData, secondPageData ]);
    const transportStream = createTransportStream(byteStream);

    transportStream.nextPage();
    const secondPage = transportStream.nextPage();

    t.is(secondPage.pageSequenceNumber, 2);
});

test('findLogicalStreams() returns a list of all detected logical streams', function (t) {
    const pages = [
        createPageData({ headerType: 2 }),
        createPageData({ headerType: 2 }),
        createPageData({ headerType: 0 })
    ];
    const byteStream = createByteStream(pages);
    const transportStream = createTransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();

    t.is(logicalStreams.length, 2);
});
