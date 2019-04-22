import test from 'ava';
import { promises as fs } from 'fs';
import path from 'path';
import { TransportStream } from '../../../src/ogg/transportStream';
import { ByteStream } from '../../../src/stream/byteStream';

async function readSimpleOggFile(): Promise<ByteStream> {
    const exampleFile = path.resolve(__dirname, '../../fixtures/320x240.ogg');
    const data = (await fs.readFile(exampleFile)).toString('binary');
    const byteStream = new ByteStream();

    byteStream.setData(data);

    return byteStream;
}

test('detects the correct amount of logical streams', async (t) => {
    const byteStream = await readSimpleOggFile();
    const transportStream = new TransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();

    t.is(logicalStreams.length, 1);
});

test('processes the first logical stream correctly', async (t) => {
    const byteStream = await readSimpleOggFile();
    const transportStream = new TransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();
    const [ first ] = logicalStreams;

    const packets = [];
    let packet = first.nextPacket();

    while (packet !== false) {
        t.snapshot(packet.data);

        packets.push(packet);
        packet = first.nextPacket();
    }

    t.is(packets.length, 123)
});
