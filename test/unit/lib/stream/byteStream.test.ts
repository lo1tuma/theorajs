import test from 'ava';
import { ByteStream } from '../../../../src/lib/stream/byteStream';

function createBufferFromString(text: string): ArrayBuffer {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    return bytes.buffer;
}

test('reads the 8-bit value of the data string', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next8(), 102);
});

test('reads 8-bit values consecutively', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('bar');

    stream.setData(data);

    stream.next8();
    stream.next8();

    t.is(stream.next8(), 114);
});

test('reads a 16-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next16(), 26223);
});

test('reads a 16-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next16(true), 28518);
});

test('reads a 24-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next24(), 6713199);
});

test('reads a 24-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foo');

    stream.setData(data);

    t.is(stream.next24(true), 7303014);
});

test('reads a 32-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobar');

    stream.setData(data);

    t.is(stream.next32(), 1718579042);
});

test('reads a 32-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobar');

    stream.setData(data);

    t.is(stream.next32(true), 1651470182);
});

test('reads a 64-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.next64(), { lowBits: 1634890101, highBits: 1718579042 });
});

test('reads a 64-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.next64(true), { lowBits: 1651470182, highBits: 1970369121 });
});

test('reads the given amount of bytes an returns them a byte array', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    t.deepEqual(stream.nextArray(3), new Uint8Array([102, 111, 111]));
});

test('skips the given amount of bytes', (t) => {
    const stream = new ByteStream();
    const data = createBufferFromString('foobarqux');

    stream.setData(data);

    stream.skip(6);

    t.deepEqual(stream.nextArray(3), new Uint8Array([113, 117, 120]));
});

for (const littleEndian of [false, true]) {
    for (const [lowBits, highBits] of [
        [0, 0],
        [1, 0],
        [4294967295, 0],
        [0, 1],
        [1, 2097152],
        [4294967295, 2147483647],
        [4294967295, -1]
    ]) {
        test(`preserves integer words ${lowBits},${highBits} with littleEndian=${littleEndian}`, (t) => {
            const buffer = new ArrayBuffer(9);
            const view = new DataView(buffer);
            view.setUint32(littleEndian ? 0 : 4, lowBits, littleEndian);
            view.setInt32(littleEndian ? 4 : 0, highBits, littleEndian);
            view.setUint8(8, 42);
            const stream = new ByteStream();
            stream.setData(buffer);

            t.deepEqual(stream.next64(littleEndian), { lowBits, highBits });
            t.is(stream.next8(), 42);
        });
    }
}

test('a truncated integer read does not consume bytes', (t) => {
    const stream = new ByteStream();
    stream.setData(new Uint8Array([42, 0, 0, 0, 0, 0, 0]).buffer);

    t.throws(() => stream.next64(true), { instanceOf: RangeError });
    t.is(stream.next8(), 42);
});
