import path from 'path';
import { promises as fs } from 'fs';
import { PNG } from 'pngjs';
import { TransportStream } from '../../src/ogg/transportStream';
import { ByteStream } from '../../src/stream/byteStream';
import { Decoder } from '../../src/theora/decoder';
import { isTheora } from '../../src/theora/header';
import { LogicalStream } from '../../src/ogg/logicalStream';
import { Packet } from '../../src/ogg/packet';
import { Frame } from '../../src/theora/frame';
import { RGBRenderer } from '../../src/player/rgbRenderer';

export async function readOggFile(file: string): Promise<ByteStream> {
    const data = (await fs.readFile(file)).toString('binary');
    const byteStream = new ByteStream();

    byteStream.setData(data);

    return byteStream;
}

function findTheoraStream(streams: LogicalStream[]): LogicalStream | undefined {
    return streams.find((stream) => isTheora(stream.getFirstPacket() as Packet));
}

export function decodeAllFrames(byteStream: ByteStream): number {
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

export function decodeAndConvertAllFrames(byteStream: ByteStream): number {
    const transportStream = new TransportStream(byteStream);

    const videoStream = findTheoraStream(transportStream.findLogicalStreams());

    if (!videoStream) {
        throw new Error('No Theora stream found in the ogg stream');
    }

    const decoder = new Decoder(videoStream);
    const renderer = new RGBRenderer(decoder);
    let frameCount = 0;
    let frame = renderer.nextRGBFrame();

    while (frame !== false) {
        frame = renderer.nextRGBFrame();
        frameCount += 1;
    }

    return frameCount;
}

type Callback = (frame: Frame, decoder: Decoder) => Promise<void>;

export async function forAllDecodedFrames(byteStream: ByteStream, callback: Callback): Promise<void> {
    const transportStream = new TransportStream(byteStream);

    const videoStream = findTheoraStream(transportStream.findLogicalStreams());

    if (!videoStream) {
        throw new Error('No Theora stream found in the ogg stream');
    }

    const decoder = new Decoder(videoStream);
    let frame = decoder.nextFrame();

    while (frame !== false) {
        // eslint-disable-next-line no-await-in-loop
        await callback(frame, decoder);
        frame = decoder.nextFrame();
    }
}

export async function forAllRGBAFrames(
    byteStream: ByteStream,
    callback: (frame: Uint8Array, decoder: Decoder, frameIndex: number) => Promise<void>
): Promise<void> {
    const transportStream = new TransportStream(byteStream);

    const videoStream = findTheoraStream(transportStream.findLogicalStreams());

    if (!videoStream) {
        throw new Error('No Theora stream found in the ogg stream');
    }

    const decoder = new Decoder(videoStream);
    const renderer = new RGBRenderer(decoder, { withAlphaChannel: true });
    let frame = renderer.nextRGBFrame();
    let index = 0;

    while (frame !== false) {
        // eslint-disable-next-line no-await-in-loop
        await callback(frame, decoder, index);

        frame = renderer.nextRGBFrame();
        index += 1;
    }
}

export async function decodeAllFramesForFile(file: string): Promise<number> {
    const byteStream = await readOggFile(file);
    return decodeAllFrames(byteStream);
}

export function frameToPng(frame: Uint8Array, decoder: Decoder): PNG {
    const png = new PNG({
        width: decoder.width,
        height: decoder.height,
        colorType: 2,
        inputColorType: 2,
        inputHasAlpha: false
    });

    png.data = frame as Buffer;

    return png;
}

export async function writePng(file: string, frame: Uint8Array, decoder: Decoder): Promise<void> {
    const png = frameToPng(frame, decoder);
    const data = PNG.sync.write(png);

    await fs.writeFile(path.resolve(process.cwd(), file), data);
}

export async function savePngDiff(file: string, png: PNG): Promise<string> {
    const data = PNG.sync.write(png);
    const outputDir = path.resolve(process.cwd(), './build/test-output/integration');
    const diffPath = path.resolve(outputDir, file);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(diffPath, data);

    return diffPath;
}

export async function readPng(file: string): Promise<PNG> {
    const data = await fs.readFile(path.resolve(process.cwd(), file));
    return PNG.sync.read(data);
}
