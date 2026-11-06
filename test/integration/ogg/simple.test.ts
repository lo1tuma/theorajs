import path from 'node:path';
import test from 'ava';
import { createTransportStream } from '../../../src/lib/ogg/transportStream.ts';
import { readOggFile } from '../../lib/video-fixtures.ts';

const simpleFile = path.resolve(import.meta.dirname, '../../fixtures/320x240.ogg');

test('detects the correct amount of logical streams', async function (t) {
    const byteStream = await readOggFile(simpleFile);
    const transportStream = createTransportStream(byteStream);

    const logicalStreams = transportStream.findLogicalStreams();

    t.is(logicalStreams.length, 1);
});

test('processes the first logical stream correctly', async function (t) {
    const [ first ] = createTransportStream(await readOggFile(simpleFile)).findLogicalStreams();
    if (first === undefined) {
        throw new Error('Missing logical stream.');
    }

    const packets = [];
    for (let packet = first.nextPacket(); packet !== false; packet = first.nextPacket()) {
        t.snapshot(packet.data);

        packets.push(packet);
    }

    t.is(packets.length, 123);
});
