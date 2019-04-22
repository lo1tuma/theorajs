import { promises as fs } from 'fs';
import { TransportStream } from '../../src/ogg/transportStream';
import { ByteStream } from '../../src/stream/byteStream';
import { Decoder } from '../../src/theora/decoder';
import { Frame } from '../../src/theora/frame';
import { isTheora } from '../../src/theora/header';
import { LogicalStream } from '../../src/ogg/logicalStream';
import { Packet } from '../../src/ogg/packet';

export async function readOggFile(file: string): Promise<ByteStream> {
    const data = (await fs.readFile(file)).toString('binary');
    const byteStream = new ByteStream();

    byteStream.setData(data);

    return byteStream;
}

function findTheoraStream(streams: LogicalStream[]): LogicalStream | undefined {
    return streams.find((stream) => isTheora(stream.getFirstPacket() as Packet));
}

export async function decodeAllFrames(file: string): Promise<number> {
    const byteStream = await readOggFile(file);
    const transportStream = new TransportStream(byteStream);

    const videoStream = findTheoraStream(transportStream.findLogicalStreams());

    if (!videoStream) {
        throw new Error('No Theora stream found in the ogg stream');
    }

    const decoder = new Decoder(videoStream);
    let frameCount = 0;
    let frame = decoder.nextFrame();

    while (frame !== false) {
        frame = decoder.nextFrame();
        frameCount += 1;
    }

    return frameCount;
}
