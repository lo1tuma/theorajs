import test from 'ava';
import { Packet } from '../../../src/ogg/packet';

test('getLength() returns 0 when no segment has been added yet', (t) => {
    const packet = new Packet();

    t.is(packet.getLength(), 0);
});

test('getLength() returns the same length as the segment when one segment has been added', (t) => {
    const packet = new Packet();
    const segment = [ 42, 42, 42, 42 ];

    packet.addSegment(segment);

    t.is(packet.getLength(), segment.length);
});

test('getLength() returns the sum of all segments length that have been added so far', (t) => {
    const packet = new Packet();
    const firstSegment = [ 1, 2 ];
    const secondSegment = [ 3 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);

    t.is(packet.getLength(), 3);
});

test('next8() returns the first byte on the first call', (t) => {
    const packet = new Packet();
    const segment = [ 42 ];

    packet.addSegment(segment);

    t.is(packet.next8(), 42);
});

test('next8() returns the second byte on the second call', (t) => {
    const packet = new Packet();
    const segment = [ 1, 2 ];

    packet.addSegment(segment);
    packet.next8();

    t.is(packet.next8(), 2);
});

test('next8() returns the second byte, added by the second segment, on the second call', (t) => {
    const packet = new Packet();
    const firstSegment = [ 1 ];
    const secondSegment = [ 2 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);
    packet.next8();

    t.is(packet.next8(), 2);
});

test('next16() returns the 16-bit value of the first two bytes on the first call', (t) => {
    const packet = new Packet();
    const segment = [ 1, 1 ];

    packet.addSegment(segment);

    t.is(packet.next16(), 257);
});

test('next16() returns the 16-bit value of the two bytes after calling next8() first', (t) => {
    const packet = new Packet();
    const segment = [ 0, 1, 1 ];

    packet.addSegment(segment);
    packet.next8();

    t.is(packet.next16(), 257);
});

test('next16() works correctly when its data originated from different segments', (t) => {
    const packet = new Packet();
    const firstSegment = [ 0, 1 ];
    const secondSegment = [ 1 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);
    packet.next8();

    t.is(packet.next16(), 257);
});

test('next24() returns the 24-bit value of the first three bytes on the first call', (t) => {
    const packet = new Packet();
    const segment = [ 1, 0, 0 ];

    packet.addSegment(segment);

    t.is(packet.next24(), 65536);
});

test('next24() returns the 24-bit value of the three bytes after calling next8() first', (t) => {
    const packet = new Packet();
    const segment = [ 1, 1, 0, 0 ];

    packet.addSegment(segment);
    packet.next8();

    t.is(packet.next24(), 65536);
});

test('next24() works correctly when its data originated from different segments', (t) => {
    const packet = new Packet();
    const firstSegment = [ 1, 1 ];
    const secondSegment = [ 0, 0 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);
    packet.next8();

    t.is(packet.next24(), 65536);
});

test('next32() returns the 32-bit value of the first four bytes on the first call', (t) => {
    const packet = new Packet();
    const segment = [ 1, 0, 0, 0 ];

    packet.addSegment(segment);

    t.is(packet.next32(), 16777216);
});

test('next32() returns the 32-bit value of the four bytes after calling next8() first', (t) => {
    const packet = new Packet();
    const segment = [ 1, 1, 0, 0, 0 ];

    packet.addSegment(segment);
    packet.next8();

    t.is(packet.next32(), 16777216);
});

test('next32() works correctly when its data originated from different segments', (t) => {
    const packet = new Packet();
    const firstSegment = [ 1, 1 ];
    const secondSegment = [ 0, 0 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);
    packet.next8();

    t.is(packet.next32(), 16777216);
});

test('get8() returns the 8-bit value of the byte for the given index', (t) => {
    const packet = new Packet();
    const firstSegment = [ 1, 2 ];
    const secondSegment = [ 3, 4 ];

    packet.addSegment(firstSegment);
    packet.addSegment(secondSegment);

    t.is(packet.get8(2), 3);
});

test('skip() skips the given amount of bytes', (t) => {
    const packet = new Packet();
    const segment = [ 1, 2, 3, 4, 5, 6 ];

    packet.addSegment(segment);
    packet.skip(3);

    t.is(packet.next8(), 4);
});

test('seek() set the current cursor to the given position', (t) => {
    const packet = new Packet();
    const segment = [ 1, 2, 3, 4, 5, 6 ];

    packet.addSegment(segment);
    packet.skip(3);
    packet.seek(1);

    t.is(packet.next8(), 2);
});
