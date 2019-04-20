importScripts(
    'https://raw.github.com/lo1tuma/theorajs/master/build/theorajs-0.1.js'
);

// Dependencies
const { decoder } = TheoraJS.Theora;
const { TransportStream } = TheoraJS.Ogg;
const { AjaxStream } = TheoraJS.Stream;
const { isTheora } = TheoraJS.Theora.header;
const { util } = TheoraJS.namespace('Theora');
// ...
let stream;
let running = false;
let divy = 1;
let divx = 1;

onmessage = function (event) {
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

function initStream(url) {
    const fileStream = new AjaxStream(url);
    let ogg;
    let logicalStreams;
    let theoraStream;
    let i;
    let retData;

    fileStream.fetch(() => {
        ogg = new TransportStream(fileStream);
        logicalStreams = ogg.findLogicalStreams();

        for (i = 0; i < logicalStreams.length; i += 1) {
            if (isTheora(logicalStreams[i].initialPacket)) {
                theoraStream = logicalStreams[i];
                break;
            }
        }

        if (!theoraStream) {
            // No theora stream found
            postMessage({ type: 'error', message: 'Invalid input file.' });
            nsIWorkerScope.close();
            return;
        }

        stream = theoraStream;
        decoder.setInputStream(stream);
        if (decoder.pixelFormat === 0) {
            divx = 2;
            divy = 2;
        } else if (decoder.pixelFormat === 2) {
            divx = 2;
        }

        retData = {
            width: decoder.width,
            height: decoder.height,
            framerate: decoder.framerate
        };
        postMessage({ type: 'success', data: retData });
    });
}

function sendFrame(frame) {
    let row;
    let col;
    let pixelX;
    let pixelY;
    let rgb;
    let i;
    let j = 0;
    const len = frame.changedPixels.length;
    const buf = new ArrayBuffer(20 * len);
    const view = new Uint32Array(buf);

    for (i = 0; i < len; i += 1) {
        col = frame.changedPixels[i][0];
        row = frame.changedPixels[i][1];

        // Skip pixels outside the picture region
        if (col <= decoder.xOffset || row <= decoder.yOffset) {
            continue;
        }

        pixelX = col - decoder.xOffset;
        pixelY = decoder.height - (row - decoder.yOffset) - 1;

        rgb = util.yCbCrToRGB(
            frame.recy[row][col],
            frame.reccb[(row / divy) | 0][(col / divx) | 0],
            frame.reccr[(row / divy) | 0][(col / divx) | 0]
        );
        view[j] = pixelY;
        view[j + 1] = pixelX;
        view[j + 2] = rgb[0];
        view[j + 3] = rgb[1];
        view[j + 4] = rgb[2];

        j += 5;
    }

    webkitPostMessage({ type: 'data', frame: view.buffer }, [view.buffer]);
}

function decode() {
    let interval;

    running = true;

    setInterval(() => {
        let frame;

        if (!running) {
            clearInterval(interval);
        }

        frame = decoder.nextFrame();
        if (frame) {
            sendFrame(frame);
        } else {
            clearInterval(interval);
            postMessage({ type: 'eos' });
            close();
        }
    }, 1);
}

function pause() {
    running = false;
}
