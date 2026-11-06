import test from 'ava';
import { createByteStream } from '../../../../src/lib/stream/byteStream.ts';

function createBufferFromString(text: string): ArrayBuffer {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    return bytes.buffer;
}

test('reads the 8-bit value of the data string', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next8(), 102);
});

test('reads 8-bit values consecutively', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('bar');

    stream.setData(data);

    stream.next8();
    stream.next8();

    t.is(stream.next8(), 114);
});

test('reads a 16-bit value with big endian byte-order when requested', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next16(false), 26_223);
});

test('reads a 16-bit value with little endian byte-order', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next16(true), 28_518);
});

test('reads a 24-bit value with big endian byte-order when requested', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next24(false), 6_713_199);
});

test('reads a 24-bit value with little endian byte-order', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next24(true), 7_303_014);
});

test('reads a 32-bit value with big endian byte-order when requested', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobar');

    stream.setData(data);

    t.is(stream.next32(false), 1_718_579_042);
});

test('reads a 32-bit value with little endian byte-order', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobar');

    stream.setData(data);

    t.is(stream.next32(true), 1_651_470_182);
});

test('reads a 64-bit value with big endian byte-order when requested', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.next64(false), { lowBits: 1_634_890_101, highBits: 1_718_579_042 });
});

test('reads a 64-bit value with little endian byte-order', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.next64(true), { lowBits: 1_651_470_182, highBits: 1_970_369_121 });
});

test('reads the given amount of bytes an returns them a byte array', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.nextArray(3), new Uint8Array([ 102, 111, 111 ]));
});

test('skips the given amount of bytes', function (t) {
    const stream = createByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    stream.skip(6);

    t.deepEqual(stream.nextArray(3), new Uint8Array([ 113, 117, 120 ]));
});

for (const littleEndian of [ false, true ]) {
    for (
        const { lowBits, highBits } of [
            { lowBits: 0, highBits: 0 },
            { lowBits: 1, highBits: 0 },
            { lowBits: 4_294_967_295, highBits: 0 },
            { lowBits: 0, highBits: 1 },
            { lowBits: 1, highBits: 2_097_152 },
            { lowBits: 4_294_967_295, highBits: 2_147_483_647 },
            { lowBits: 4_294_967_295, highBits: -1 }
        ]
    ) {
        test(`preserves integer words ${lowBits},${highBits} with littleEndian=${littleEndian}`, function (t) {
            const buffer = new ArrayBuffer(9);
            const view = new DataView(buffer);
            view.setUint32(littleEndian ? 0 : 4, lowBits, littleEndian);
            view.setInt32(littleEndian ? 4 : 0, highBits, littleEndian);
            view.setUint8(8, 42);
            const stream = createByteStream();
            stream.setData(buffer);

            t.deepEqual(stream.next64(littleEndian), { lowBits, highBits });
            t.is(stream.next8(), 42);
        });
    }
}

test('a truncated integer read does not consume bytes', function (t) {
    const stream = createByteStream();
    const bytes = new Uint8Array([ 42, 0, 0, 0, 0, 0, 0 ]);
    stream.setData(bytes.buffer);

    t.throws(function () {
        return stream.next64(true);
    }, { instanceOf: RangeError });
    t.is(stream.next8(), 42);
});
