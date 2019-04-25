/**
 * Set the default dimension of the canvas
 *
 * @method initCanvas
 * @private
 * @param {Object} canvas
 * @return {Object} context
 */
function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Couldn’t initial canvas');
    }

    canvas.width = 400;
    canvas.height = 240;

    drawDefaultBackground(ctx, 400, 240);

    return ctx;
}

function drawDefaultBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
}

function removeFromDom(elemId: string, child: HTMLElement): void {
    const element = document.querySelector(`#${elemId}`);

    if (element) {
        element.removeChild(child);
    }
}

function addToDom(elemId: string, child: HTMLElement): void {
    const element = document.querySelector(`#${elemId}`);

    if (element) {
        element.append(child);
    }
}

interface DecoderData {
    width: number;
    height: number;
    framerate: number;
}

/**
 * Simple Theora video player, which makes use auf a Theora decoder in a dedicated Web Worker.
 *
 * @main TheoraPlayer
 * @module TheoraPlayer
 * @class TheoraPlayer
 */
export class TheoraPlayer {
    private cnt: number;

    private canvas: HTMLCanvasElement;

    private context: CanvasRenderingContext2D;

    private onStartCallback: () => void;

    private onStopCallback: (cnt: number, framerate: number) => void;

    private elemId: string;

    private worker: Worker;

    private frames: ImageData[];

    private info: DecoderData;

    private imageSize: number;

    private interval: number;

    /**
     * Simple demo theora player, which works with a dedicated decoder worker.
     *
     * @class TheoraPlayer
     * @constructor
     * @param {String} url
     * @param {String} Element id
     * elemid
     */
    constructor(
        url: string,
        elemId: string,
        workerPath: string,
        onStart: () => void,
        onStop: (cnt: number, framerate: number) => void
    ) {
        this.cnt = 0;
        this.canvas = document.createElement('canvas');
        this.context = initCanvas(this.canvas);
        this.onStartCallback = onStart;
        this.onStopCallback = onStop;
        this.elemId = elemId;

        addToDom(elemId, this.canvas);

        this.worker = new Worker(workerPath);
        this.worker.addEventListener('message', this.listen);

        this.worker.postMessage({ type: 'command', command: 'init', url });

        this.frames = [];

        this.info = {
            width: 0,
            height: 0,
            framerate: 0
        };

        this.imageSize = 0;

        this.interval = 0;
    }

    addFrame(frame: ArrayBuffer): void {
        const imgData = new ImageData(new Uint8ClampedArray(frame), this.info.width, this.info.height);
        this.frames.push(imgData);
    }

    adjustCanvas(): void {
        this.canvas.width = this.info.width;
        this.canvas.height = this.info.height;
    }

    start(data: DecoderData): void {
        this.info = data;
        this.adjustCanvas();
        this.worker.postMessage({ type: 'command', command: 'decode' });
        this.imageSize = data.width * data.height * 4;
        this.onStartCallback();
        this.interval = window.setInterval(this.draw, 1000 / data.framerate);
    }

    clear(): void {
        removeFromDom(this.elemId, this.canvas);
    }

    stop(): void {
        window.clearInterval(this.interval);
        this.onStopCallback(this.cnt, this.info.framerate);
    }

    private draw = (): void => {
        const frame = this.frames.shift();

        if (frame) {
            this.context.putImageData(frame, 0, 0);
        }
    };

    private listen = (event: MessageEvent): void => {
        const msg = event.data;

        if (msg.type === 'error') {
            console.log('error');
            return;
        }

        if (msg.type === 'success') {
            this.start(msg.data);
            return;
        }

        if (msg.type === 'eos') {
            this.worker.terminate();
            this.stop();
            this.cnt = 0;
            return;
        }

        if (msg.type === 'data') {
            console.log(`frame ${this.cnt + 1} decoded`);
            this.cnt += 1;
            this.addFrame(msg.frame);
        }
    };
}
