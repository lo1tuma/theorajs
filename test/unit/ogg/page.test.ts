import test from 'ava';
import { Page } from '../../../src/ogg/page';
import { ByteStream } from '../../../src/stream/byteStream';

function createStream(data: string): ByteStream {
    const stream = new ByteStream();

    stream.setData(data);

    return stream;
}

function createPage(data: string): Page {
    const stream = createStream(data);
    const page = new Page(stream);

    return page;
}

function createValidPage(data: number[]): Page {
    const dataString = `OggS${String.fromCharCode(...data)}`;
    return createPage(dataString);
}

test('throws an error when the ogg capture pattern can’t be found', (t) => {
    t.throws(() => createPage('foobar'), { message: 'Page has invalid capturePattern.', name: 'OggError' });
});

test('doesn’t throw when a valid ogg capute pattern can be found', (t) => {
    t.notThrows(() => createPage('OggSfoobar'));
});

test('decodes and expose the stream structure version', (t) => {
    const page = createValidPage([42]);

    t.is(page.version, 42);
});

test('decodes and expose the header type', (t) => {
    const page = createValidPage([0, 42]);

    t.is(page.headerType, 42);
});

test('returns true when the page is a continued page within a stream', (t) => {
    const page = createValidPage([0, 1]);

    t.true(page.isContinuedPage());
});

test('returns false when the page is the first page within a stream', (t) => {
    const page = createValidPage([0, 0]);

    t.false(page.isContinuedPage());
});

test('returns true when the page is the first page within a stream', (t) => {
    const page = createValidPage([0, 2]);

    t.true(page.isBeginOfStream());
});

test('returns false when the page is not the first page within a stream', (t) => {
    const page = createValidPage([0, 1]);

    t.false(page.isBeginOfStream());
});

test('returns true when the page is the last page within a stream', (t) => {
    const page = createValidPage([0, 4]);

    t.true(page.isEndOfStream());
});

test('returns false when the page is not the last page within a stream', (t) => {
    const page = createValidPage([0, 3]);

    t.false(page.isEndOfStream());
});

test('decodes and expose the granule position', (t) => {
    const page = createValidPage([0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);

    t.deepEqual(page.granulePosition, {
        lowBits: 67305985,
        highBits: 134678021
    });
});

test('decodes and expose the serial number', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);

    t.is(page.serialNumber, 16843009);
});

test('decodes and expose the page sequence number', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);

    t.is(page.pageSequenceNumber, 16843009);
});

test('decodes and expose the checksum', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);

    t.is(page.checksum, 16843009);
});

test('decodes and expose the number of segments', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42]);

    t.is(page.pageSegments, 42);
});

test('calculates the total size of the page header', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42]);

    t.is(page.headerLength, 69);
});

test('decodes and expose the segment table which contains the size of each segment', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 2, 3]);

    t.deepEqual(page.segmentTable, [1, 2, 3]);
});

test('calculates the total size of the page body', (t) => {
    const page = createValidPage([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 2, 3]);

    t.is(page.bodyLength, 6);
});

test('decodes and expose the segments', (t) => {
    const page = createValidPage([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        1,
        2,
        3,
        1,
        1,
        1,
        1,
        1,
        1
    ]);

    t.deepEqual(page.segments, [[1], [1, 1], [1, 1, 1]]);
});
