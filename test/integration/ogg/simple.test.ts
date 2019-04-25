import path from 'path';
import test from 'ava';
import { TransportStream } from '../../../src/lib/ogg/transportStream';
import { readOggFile } from '../../lib/files';

const simpleFile = path.resolve(__dirname, '../../fixtures/320x240.ogg');

test('detects the correct amount of logical streams', async (t) => {
    const byteStream = await readOggFile(simpleFile);
    const transportStream = new TransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();

    t.is(logicalStreams.length, 1);
});

test('processes the first logical stream correctly', async (t) => {
    const byteStream = await readOggFile(simpleFile);
    const transportStream = new TransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();
    const [first] = logicalStreams;

    const packets = [];
    let packet = first.nextPacket();

    while (packet !== false) {
        t.snapshot(packet.data);

        packets.push(packet);
        packet = first.nextPacket();
    }

    t.is(packets.length, 123);
});
