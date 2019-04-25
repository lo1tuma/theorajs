import { Decoder } from '../../lib/theora/decoder';
import { TransportStream } from '../../lib/ogg/transportStream';
import { isTheora } from '../../lib/theora/header';
import { RGBRenderer } from '../../lib/player/rgbRenderer';
import { Packet } from '../../lib/ogg/packet';
import { AjaxStream } from './ajaxStream';

let running = false;
let renderer: RGBRenderer;

onmessage = (event: MessageEvent): void => {
    const msg = event.data;

    if (msg.type !== 'command') {
        return;
    }

    switch (msg.command) {
        case 'init':
            initStream(msg.url);
            break;
        case 'decode':
            decode();
            break;
        case 'pause':
            pause();
            break;
        default:
            postMessage('Unknown command');
            break;
    }
};

function initStream(url: string): void {
    const fileStream = new AjaxStream(url);

    fileStream.fetch(() => {
        const ogg = new TransportStream(fileStream);
        const logicalStreams = ogg.findLogicalStreams();
        let theoraStream;

        for (let i = 0; i < logicalStreams.length; i += 1) {
            if (isTheora(logicalStreams[i].getFirstPacket() as Packet)) {
                theoraStream = logicalStreams[i];
                break;
            }
        }

        if (!theoraStream) {
            // No theora stream found
            postMessage({ type: 'error', message: 'Invalid input file.' });
            close();
            return;
        }

        const decoder = new Decoder(theoraStream);
        renderer = new RGBRenderer(decoder, { withAlphaChannel: true });

        const retData = {
            width: decoder.width,
            height: decoder.height,
            framerate: decoder.framerate
        };
        postMessage({ type: 'success', data: retData });
    });
}

function sendFrame(frame: Uint8Array): void {
    postMessage({ type: 'data', frame: frame.buffer }, [frame.buffer]);
}

function decode(): void {
    running = true;

    const interval = setInterval(() => {
        if (!running) {
            clearInterval(interval);
        }

        const frame = renderer.nextRGBFrame();
        if (frame) {
            sendFrame(frame);
        } else {
            clearInterval(interval);
            postMessage({ type: 'eos' });
            close();
        }
    }, 1);
}

function pause(): void {
    running = false;
}
