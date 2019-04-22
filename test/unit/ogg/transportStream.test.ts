import test from 'ava';
import { TransportStream } from '../../../src/ogg/transportStream';
import { ByteStream } from '../../../src/stream/byteStream';

interface PageDataOverrides {
    headerType?: number;
    pageSequenceNumber?: number[];
}

function createPageData(overrides: PageDataOverrides = {}): string {
    const { headerType = 0, pageSequenceNumber = [0, 0, 0, 0] } = overrides;
    const version = 0;
    const granulePosition = [0, 0, 0, 0, 0, 0, 0, 0];
    const serialNumber = [0, 0, 0, 0];
    const checksum = [0, 0, 0, 0];
    const pageSegments = 1;
    const segmentTable = [1];
    const segments = [42];
    const data = [
        version,
        headerType,
        ...granulePosition,
        ...serialNumber,
        ...pageSequenceNumber,
        ...checksum,
        pageSegments,
        ...segmentTable,
        ...segments
    ];

    return `OggS${String.fromCharCode(...data)}`;
}

function createByteStream(pages: string[]): ByteStream {
    const stream = new ByteStream();

    stream.setData(pages.join(''));

    return stream;
}

test('nextPage() returns the first Page instance on the first call', (t) => {
    const pageData = createPageData({ pageSequenceNumber: [1, 0, 0, 0] });
    const byteStream = createByteStream([pageData]);
    const transportStream = new TransportStream(byteStream);

    const page = transportStream.nextPage();

    t.is(page.pageSequenceNumber, 1);
});

test('nextPage() returns the second Page instance on the second call', (t) => {
    const firstPageData = createPageData({ pageSequenceNumber: [1, 0, 0, 0] });
    const secondPageData = createPageData({ pageSequenceNumber: [2, 0, 0, 0] });
    const byteStream = createByteStream([firstPageData, secondPageData]);
    const transportStream = new TransportStream(byteStream);

    transportStream.nextPage();
    const secondPage = transportStream.nextPage();

    t.is(secondPage.pageSequenceNumber, 2);
});

test('findLogicalStreams() returns a list of all detected logical streams', (t) => {
    const pages = [
        createPageData({ headerType: 2 }),
        createPageData({ headerType: 2 }),
        createPageData({ headerType: 0 })
    ];
    const byteStream = createByteStream(pages);
    const transportStream = new TransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();

    t.is(logicalStreams.length, 2);
});
