/**
 * Simple Theora video player, which makes use auf a Theora decoder in a dedicated Web Worker.
 *
 * @main TheoraPlayer
 * @module TheoraPlayer
 * @class TheoraPlayer
 */
var TheoraPlayer = (function () {
    let workerPath =
        'https://raw.github.com/lo1tuma/theorajs/master/src/Worker.js';
    // Export
    let Constructor;
    let cnt = 0;

    /**
     * Set the default dimension of the canvas
     *
     * @method initCanvas
     * @private
     * @param {Object} canvas
     * @return {Object} context
     */
    function initCanvas(canvas) {
        const ctx = canvas.getContext('2d');

        canvas.width = 400;
        canvas.height = 240;

        drawDefaultBackground(ctx, 400, 240);

        return ctx;
    }

    function drawDefaultBackground(context, width, height) {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, width, height);
    }

    function removeFromDom(elemId, child) {
        document.getElementById(elemId).removeChild(child);
    }

    function addToDom(elemId, child) {
        document.getElementById(elemId).append(child);
    }

    function listen(event, player) {
        const msg = event.data;

        if (msg.type === 'error') {
            console.log('error');
            return;
        }

        if (msg.type === 'success') {
            player.start(msg.data);
            return;
        }

        if (msg.type === 'eos') {
            player.worker.terminate();
            player.stop();
            cnt = 0;
            return;
        }

        if (msg.type === 'data') {
            console.log('frame ' + (cnt + 1) + ' decoded');
            cnt += 1;
            player.addFrame(msg.frame);
        }
    }

    /**
     * Simple demo theora player, which works with a dedicated decoder worker.
     *
     * @class TheoraPlayer
     * @constructor
     * @param {String} url
     * @param {String} Element id
     * elemid
     */
    Constructor = function (url, elemId, wPath, onStart, onStop) {
        const self = this;
        workerPath = wPath;
        this.canvas = document.createElement('canvas');
        this.context = initCanvas(this.canvas);
        this.onStartCallback = onStart;
        this.onStopCallback = onStop;
        this.elemId = elemId;
        addToDom(elemId, this.canvas);

        this.worker = new Worker(workerPath);
        this.worker.addEventListener('message', event => {
            listen(event, self);
        });

        this.worker.postMessage({ type: 'command', command: 'init', url });

        this.frames = [];

        this.info = {};
    };

    Constructor.prototype = {
        // Reset constructor reference
        constructor: TheoraPlayer,

        addFrame(frame) {
            this.frames.push(frame);
        },

        toImage(frame) {
            let y;
            let x;
            const buf = new ArrayBuffer(this.imageSize);
            const data = new Uint32Array(buf);

            for (y = 0; y < frame.length; y += 1) {
                for (x = 0; x < frame[y].length; x += 1) {
                    data[y * this.info.width + x] =
                        (255 << 24) | // Alpha
                        (frame[y][x][2] << 16) | // Blue
                        (frame[y][x][1] << 8) | // Green
                        frame[y][x][0]; // Red
                }
            }

            return buf;
        },

        adjustCanvas() {
            this.canvas.width = this.info.width;
            this.canvas.height = this.info.height;
        },

        start(data) {
            const self = this;
            this.info = data;
            this.adjustCanvas();
            this.worker.postMessage({ type: 'command', command: 'decode' });
            this.imageSize = data.width * data.height * 4;
            this.img = this.context.getImageData(0, 0, data.width, data.height);
            this.onStartCallback();
            this.interval = window.setInterval(() => {
                self.draw();
            }, 1000 / data.framerate);
        },

        clear() {
            removeFromDom(this.elemId, this.canvas);
        },

        stop() {
            window.clearInterval(this.interval);
            this.onStopCallback(cnt, this.info.framerate);
        },

        draw() {
            let frame;
            let y;
            let x;
            let i;
            let rgb;
            let j;
            const img = this.img.data;
            let view;

            frame = this.frames.shift();

            if (frame) {
                view = new Uint32Array(frame);
                for (i = 0; i < view.length; i += 5) {
                    y = view[i];
                    x = view[i + 1];
                    j = 4 * (y * this.info.width + x);
                    img[j] = view[i + 2];
                    img[j + 1] = view[i + 3];
                    img[j + 2] = view[i + 4];
                    img[j + 3] = 255;
                }

                this.context.putImageData(this.img, 0, 0);
            }
        }
    };

    // Export
    return Constructor;
})();
