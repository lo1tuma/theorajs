import { createFireAndForgetInvoker } from '@enormora/fire-and-forget';
import { match } from 'ts-pattern';
import { createDecoder } from '../../lib/theora/decoder.ts';
import { createTransportStream } from '../../lib/ogg/transportStream.ts';
import type { LogicalStream } from '../../lib/ogg/logicalStream.ts';
import { createByteStream, type ByteStream } from '../../lib/stream/byteStream.ts';
import { isTheora } from '../../lib/theora/headers/protocol.ts';
import { createRGBRenderer, type RGBRenderer } from '../../lib/player/rgbRenderer.ts';
import { readDecoderCommand, type DecoderCommand, type WorkerReply } from '../messages/messages.ts';

function reportFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unable to decode video.';
    const reply: WorkerReply = { type: 'error', message };
    postMessage(reply);
    close();
}

async function loadVideo(url: string): Promise<ByteStream> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load video: ${response.status}`);
    }
    const stream = createByteStream();
    stream.setData(await response.arrayBuffer());
    return stream;
}

function hasTheoraPacket(stream: LogicalStream): boolean {
    const packet = stream.getFirstPacket();
    return packet !== false && isTheora(packet);
}

async function initialize(url: string): Promise<RGBRenderer> {
    const input = await loadVideo(url);
    const stream = createTransportStream(input).findLogicalStreams().find(hasTheoraPacket);
    if (stream === undefined) {
        throw new Error('Invalid input file.');
    }
    const decoder = createDecoder(stream);
    const renderer = createRGBRenderer(decoder, { withAlphaChannel: true });
    const data = { width: decoder.width, height: decoder.height, framerate: decoder.framerate };
    const reply: WorkerReply = { type: 'success', data };
    postMessage(reply);
    return renderer;
}

function sendFrame(frame: Uint8Array<ArrayBuffer>): void {
    const reply: WorkerReply = { type: 'data', frame: frame.buffer };
    postMessage(reply, [ frame.buffer ]);
}

function complete(): void {
    const reply: WorkerReply = { type: 'eos' };
    postMessage(reply);
    close();
}

function createWorkerSession(): (command: DecoderCommand) => void {
    let running = false;
    let renderer: RGBRenderer | null = null;
    const invoker = createFireAndForgetInvoker({ reportError: reportFailure });

    function decode(): void {
        const active = renderer;
        if (active === null) {
            throw new Error('Decoder is not initialized.');
        }
        running = true;
        const interval = setInterval(function () {
            if (!running) {
                clearInterval(interval);
            }
            const frame = active.nextRGBFrame();
            if (frame === false) {
                clearInterval(interval);
                complete();
            } else {
                sendFrame(frame);
            }
        }, 1);
    }

    return function (command: DecoderCommand): void {
        match(command)
            .with({ command: 'init' }, function ({ url }) {
                invoker.fireAndForget(async function () {
                    renderer = await initialize(url);
                });
            })
            .with({ command: 'decode' }, decode)
            .with({ command: 'pause' }, function () {
                running = false;
            })
            .with({ command: 'unknown' }, function () {
                reportFailure(new Error('Unknown command'));
            })
            .exhaustive();
    };
}

const receive = createWorkerSession();
addEventListener('message', function (messageEvent: MessageEvent<unknown>): void {
    const command = readDecoderCommand(messageEvent.data);
    if (command !== null) {
        receive(command);
    }
});
