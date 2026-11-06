import Queue from 'yocto-queue';
import { match } from 'ts-pattern';
import { type DecoderCommand, type DecoderMetadata, type WorkerReply, readWorkerReply } from '../messages/messages.ts';

const INITIAL_WIDTH = 400;
const INITIAL_HEIGHT = 240;
const MILLISECONDS_PER_SECOND = 1000;

export type PlayerOptions = {
    readonly url: string;
    readonly elementId: string;
    readonly workerPath: string;
    readonly onStart: () => void;
    readonly onStop: (frames: number, framerate: number) => void;
    readonly onError: (message: string) => void;
};
type PlaybackOptions = Pick<PlayerOptions, 'onError' | 'onStart' | 'onStop'> & {
    readonly canvas: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D;
    readonly worker: Worker;
};
type Playback = { readonly receive: (reply: WorkerReply) => void; };

type CanvasSurface = { readonly canvas: HTMLCanvasElement; readonly context: CanvasRenderingContext2D; };

function initializeCanvas(): CanvasSurface {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context === null) {
        throw new Error('Could not initialize canvas');
    }
    canvas.width = INITIAL_WIDTH;
    canvas.height = INITIAL_HEIGHT;
    context.fillStyle = '#000000';
    context.fillRect(0, 0, INITIAL_WIDTH, INITIAL_HEIGHT);
    return { canvas, context };
}

function createPlayback(options: PlaybackOptions): Playback {
    const queue = new Queue<ImageData>();
    const { canvas, context, worker } = options;
    let metadata: DecoderMetadata | null = null;
    let timer: number | null = null;
    let decodedFrames = 0;
    function draw(): void {
        const frame = queue.dequeue();
        if (frame !== undefined) {
            context.putImageData(frame, 0, 0);
        }
    }
    function start(data: DecoderMetadata): void {
        metadata = data;
        canvas.width = data.width;
        canvas.height = data.height;
        const command: DecoderCommand = { type: 'command', command: 'decode' };
        worker.postMessage(command);
        options.onStart();
        timer = setInterval(draw, MILLISECONDS_PER_SECOND / data.framerate);
    }
    function finishPlayback(): void {
        if (timer !== null) {
            clearInterval(timer);
        }
        if (metadata !== null) {
            options.onStop(decodedFrames, metadata.framerate);
        }
        decodedFrames = 0;
        timer = null;
    }
    function receiveFrame(frame: ArrayBuffer): void {
        if (metadata === null) {
            options.onError('Received a frame before decoder metadata.');
            return;
        }
        decodedFrames += 1;
        queue.enqueue(new ImageData(new Uint8ClampedArray(frame), metadata.width, metadata.height));
    }
    return {
        receive(reply: WorkerReply): void {
            match(reply)
                .with({ type: 'error' }, function ({ message }) {
                    options.onError(message);
                })
                .with({ type: 'success' }, function ({ data }) {
                    start(data);
                })
                .with({ type: 'eos' }, function () {
                    worker.terminate();
                    finishPlayback();
                })
                .with({ type: 'data' }, function ({ frame }) {
                    receiveFrame(frame);
                })
                .exhaustive();
        }
    };
}

export function startPlayer(options: PlayerOptions): void {
    const { canvas, context } = initializeCanvas();
    document.querySelector(`#${CSS.escape(options.elementId)}`)?.append(canvas);
    const worker = new Worker(options.workerPath);
    const playback = createPlayback({ ...options, canvas, context, worker });
    worker.addEventListener('message', function (messageEvent: MessageEvent<unknown>): void {
        const reply = readWorkerReply(messageEvent.data);
        if (reply !== null) {
            playback.receive(reply);
        }
    });
    const command: DecoderCommand = { type: 'command', command: 'init', url: options.url };
    worker.postMessage(command);
}
