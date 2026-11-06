import test from 'ava';
import { type Page, readPage } from '../../../../src/lib/ogg/page.ts';
import { type ByteStream, createByteStream } from '../../../../src/lib/stream/byteStream.ts';

function createStream(data: string): ByteStream {
    const stream = createByteStream();
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const minSize = 255;
    const buffer = new ArrayBuffer(Math.max(data.length, minSize));
    const view = new Uint8Array(buffer);

    view.set(bytes, 0);

    stream.setData(view.buffer);

    return stream;
}

function createPage(data: string): Page {
    const stream = createStream(data);
    const page = readPage(stream);

    return page;
}

function createValidPage(data: readonly number[]): Page {
    const dataString = `OggS${String.fromCodePoint(...data)}`;
    return createPage(dataString);
}

test('throws an error when the ogg capture pattern can’t be found', function (t) {
    t.throws(function () {
        return createPage('foobar');
    }, { message: 'Page has invalid capturePattern.', name: 'OggError' });
});

test('doesn’t throw when a valid ogg capute pattern can be found', function (t) {
    t.notThrows(function () {
        return createPage('OggS');
    });
});

test('decodes and expose the stream structure version', function (t) {
    const page = createValidPage([ 42 ]);

    t.is(page.version, 42);
});

test('decodes and expose the header type', function (t) {
    const page = createValidPage([ 0, 42 ]);

    t.is(page.headerType, 42);
});

test('returns true when the page is a continued page within a stream', function (t) {
    const page = createValidPage([ 0, 1 ]);

    t.true(page.isContinuedPage());
});

test('returns false when the page is the first page within a stream', function (t) {
    const page = createValidPage([ 0, 0 ]);

    t.false(page.isContinuedPage());
});

test('returns true when the page is the first page within a stream', function (t) {
    const page = createValidPage([ 0, 2 ]);

    t.true(page.isBeginOfStream());
});

test('returns false when the page is not the first page within a stream', function (t) {
    const page = createValidPage([ 0, 1 ]);

    t.false(page.isBeginOfStream());
});

test('returns true when the page is the last page within a stream', function (t) {
    const page = createValidPage([ 0, 4 ]);

    t.true(page.isEndOfStream());
});

test('returns false when the page is not the last page within a stream', function (t) {
    const page = createValidPage([ 0, 3 ]);

    t.false(page.isEndOfStream());
});

test('decodes and expose the granule position', function (t) {
    const page = createValidPage([ 0, 0, 1, 2, 3, 4, 5, 6, 7, 8 ]);

    t.deepEqual(page.granulePosition, { lowBits: 67_305_985, highBits: 134_678_021 });
});

test('decodes and expose the serial number', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1 ]);

    t.is(page.serialNumber, 16_843_009);
});

test('decodes and expose the page sequence number', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1 ]);

    t.is(page.pageSequenceNumber, 16_843_009);
});

test('decodes and expose the checksum', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1 ]);

    t.is(page.checksum, 16_843_009);
});

test('decodes and expose the number of segments', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42 ]);

    t.is(page.pageSegments, 42);
});

test('calculates the total size of the page header', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42 ]);

    t.is(page.headerLength, 69);
});

test('decodes and expose the segment table which contains the size of each segment', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 2, 3 ]);

    t.deepEqual(page.segmentTable, [ 1, 2, 3 ]);
});

test('calculates the total size of the page body', function (t) {
    const page = createValidPage([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 2, 3 ]);

    t.is(page.bodyLength, 6);
});

test('decodes and expose the segments', function (t) {
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

    t.deepEqual(page.segments, [ new Uint8Array([ 1 ]), new Uint8Array([ 1, 1 ]), new Uint8Array([ 1, 1, 1 ]) ]);
});

test('preserves the unknown granule sentinel', function (t) {
    const stream = createByteStream();
    const bytes = new Uint8Array(27);
    bytes.set([ 79, 103, 103, 83 ]);
    bytes.fill(255, 6, 14);
    stream.setData(bytes.buffer);

    t.deepEqual(readPage(stream).granulePosition, { lowBits: 4_294_967_295, highBits: -1 });
});
