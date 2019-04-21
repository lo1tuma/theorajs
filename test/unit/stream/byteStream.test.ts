import test from 'ava';
import { ByteStream } from '../../../src/stream/byteStream';

test('reads the 8-bit value of the data string', (t) => {
    const stream = new ByteStream();

    stream.setData('foo');

    t.is(stream.next8(), 102);
});

test('reads 8-bit values consecutively', (t) => {
    const stream = new ByteStream();

    stream.setData('bar');
    stream.next8();
    stream.next8();

    t.is(stream.next8(), 114);
});

test('reads a 16-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();

    stream.setData('foo');

    t.is(stream.next16(), 26223);
});

test('reads a 16-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();

    stream.setData('foo');

    t.is(stream.next16(true), 28518);
});

test('reads a 24-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();

    stream.setData('foo');

    t.is(stream.next24(), 6713199);
});

test('reads a 24-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();

    stream.setData('foo');

    t.is(stream.next24(true), 7303014);
});

test('reads a 32-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();

    stream.setData('foobar');

    t.is(stream.next32(), 1718579042);
});

test('reads a 32-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();

    stream.setData('foobar');

    t.is(stream.next32(true), 1651470182);
});

test('reads a 64-bit value with big endian byte-order by default', (t) => {
    const stream = new ByteStream();

    stream.setData('foobarqux');

    t.deepEqual(stream.next64(), { lowBits: 1634890101, highBits: 1718579042 });
});

test('reads a 64-bit value with little endian byte-order', (t) => {
    const stream = new ByteStream();

    stream.setData('foobarqux');

    t.deepEqual(stream.next64(true), { lowBits: 1651470182, highBits: 1970369121 });
});

test('reads the given amount of bytes an returns them a byte array', (t) => {
    const stream = new ByteStream();

    stream.setData('foobarqux');

    t.deepEqual(stream.nextArray(3), [102, 111, 111]);
});

test('skips the given amount of bytes', (t) => {
    const stream = new ByteStream();

    stream.setData('foobarqux');
    stream.skip(6);

    t.deepEqual(stream.nextArray(3), [113, 117, 120]);
});
