import { promises as fileSystem } from 'node:fs';
import type { LogicalStream } from '../../src/lib/ogg/logicalStream.ts';
import { createTransportStream } from '../../src/lib/ogg/transportStream.ts';
import { createRGBRenderer, type RGBRenderer } from '../../src/lib/player/rgbRenderer.ts';
import { createByteStream, type ByteStream } from '../../src/lib/stream/byteStream.ts';
import { createDecoder, type Decoder } from '../../src/lib/theora/decoder.ts';
import type { Frame } from '../../src/lib/theora/frame.ts';
import { isTheora } from '../../src/lib/theora/headers/protocol.ts';

type FrameCallback = (frame: Frame, decoder: Decoder) => Promise<void>;
type PictureCallback = (frame: Uint8Array<ArrayBuffer>, decoder: Decoder, index: number) => Promise<void>;

export async function readOggFile(file: string): Promise<ByteStream> {
    const bytes = await fileSystem.readFile(file);
    const stream = createByteStream();
    stream.setData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    return stream;
}

function hasTheoraPacket(stream: LogicalStream): boolean {
    const packet = stream.getFirstPacket();
    return packet !== false && isTheora(packet);
}

export function requireTheoraStream(bytes: ByteStream): LogicalStream {
    const stream = createTransportStream(bytes).findLogicalStreams().find(hasTheoraPacket);
    if (stream === undefined) {
        throw new Error('No Theora stream found in the ogg stream');
    }
    return stream;
}

export async function readVideoFixture(file: string): Promise<Decoder> {
    return createDecoder(requireTheoraStream(await readOggFile(file)));
}

function* decodedFrames(decoder: Decoder): Generator<Frame, void, unknown> {
    for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
        yield frame;
    }
}

function* renderedFrames(renderer: RGBRenderer): Generator<Uint8Array<ArrayBuffer>, void, unknown> {
    for (let frame = renderer.nextRGBFrame(); frame !== false; frame = renderer.nextRGBFrame()) {
        yield frame;
    }
}

export function decodeAllFrames(bytes: ByteStream): number {
    return decodedFrames(createDecoder(requireTheoraStream(bytes))).reduce(function (count) {
        return count + 1;
    }, 0);
}

export function decodeAndConvertAllFrames(bytes: ByteStream): number {
    const decoder = createDecoder(requireTheoraStream(bytes));
    const renderer = createRGBRenderer(decoder, { withAlphaChannel: false });
    return renderedFrames(renderer).reduce(function (count) {
        return count + 1;
    }, 0);
}

export async function forAllDecodedFrames(bytes: ByteStream, callback: FrameCallback): Promise<void> {
    const decoder = createDecoder(requireTheoraStream(bytes));
    await Array.fromAsync(decodedFrames(decoder), async function (frame) {
        return callback(frame, decoder);
    });
}

export async function forAllRGBAFrames(bytes: ByteStream, callback: PictureCallback): Promise<void> {
    const decoder = createDecoder(requireTheoraStream(bytes));
    const renderer = createRGBRenderer(decoder, { withAlphaChannel: true });
    await Array.fromAsync(renderedFrames(renderer), async function (frame, index) {
        return callback(frame, decoder, index);
    });
}

export async function decodeAllFramesForFile(file: string): Promise<number> {
    return decodeAllFrames(await readOggFile(file));
}
