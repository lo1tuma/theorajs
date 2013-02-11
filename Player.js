/**
 * Simple Theora video player, which makes use auf a Theora decoder in a dedicated Web Worker.
 *
 * @main TheoraPlayer
 * @module TheoraPlayer
 * @class TheoraPlayer
 */
var TheoraPlayer = (function () {
	var workerPath = "Worker.js",

		// export
		Constructor;
	var cnt = 0;

	/**
	 * Set the default dimension of the canvas
	 *
	 * @method initCanvas
	 * @private
	 * @param {Object} canvas
	 * @return {Object} context
	 */
	function initCanvas (canvas) {
		var ctx = canvas.getContext("2d");

		canvas.width = 400;
		canvas.height = 240;

		drawDefaultBackground(ctx, 400, 240);

		return ctx;
	}

	function drawDefaultBackground (context, width, height) {
		context.fillStyle = "#000000";
		context.fillRect(0, 0, width, height);
	}

	function removeFromDom(elemId, child) {
		document.getElementById(elemId).removeChild(child);
	}

	function addToDom (elemId, child) {
		document.getElementById(elemId).appendChild(child);
	}

	function listen (event, player) {
		var msg = event.data;

		if (msg.type === "error") {
			console.log("error");
			return;
		}

		if (msg.type === "success") {
			player.start(msg.data);
			return;
		}

		if (msg.type === "eos") {
			player.worker.terminate();
			player.stop();
			cnt = 0;
			return;
		}

		if (msg.type === "data") {
			console.log("frame "+(cnt + 1)+" decoded");
			cnt += 1;
			player.addFrame(msg.frame);
			return;
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
		var self = this;
		workerPath = wPath;
		this.canvas = document.createElement("canvas");
		this.context = initCanvas(this.canvas);
		this.onStartCallback = onStart;
		this.onStopCallback = onStop;
		this.elemId = elemId;
		addToDom(elemId, this.canvas);
		
		this.worker = new Worker(workerPath);
		this.worker.onmessage = function (event) {
			listen(event, self);
		};

		this.worker.postMessage({type: "command", command: "init", url: url});

		this.frames = [];

		this.info = {};
		
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraPlayer,

		addFrame: function (frame) {
			this.frames.push(frame);
		},

		toImage: function (frame) {
			var y, x,
				buf = new ArrayBuffer(this.imageSize),
				data = new Uint32Array(buf);

			for (y = 0; y < frame.length; y += 1) {
				for (x = 0; x < frame[y].length; x += 1) {
					data[y * this.info.width + x] = 
						(255 << 24) | 			// alpha
						(frame[y][x][2] << 16) | 	// blue
						(frame[y][x][1] << 8) | 	// green
						frame[y][x][0];			// red
				}
			}
			return buf;
		},

		adjustCanvas: function() {
			this.canvas.width = this.info.width;
			this.canvas.height = this.info.height;
		},

		start: function (data) {
			var self = this;
			this.info = data;
			this.adjustCanvas();
			this.worker.postMessage({type: "command", command: "decode"});
			this.imageSize = data.width * data.height * 4;
			this.img = this.context.getImageData(0, 0, data.width, data.height);
			this.onStartCallback();
			this.interval = window.setInterval(function () {
				self.draw();
			}, 1000/data.framerate);
		},

		clear: function () {
			removeFromDom(this.elemId, this.canvas);
		},

		stop: function () {
			window.clearInterval(this.interval);
			this.onStopCallback(cnt, this.info.framerate);
		},

		draw: function () {
			var frame, y, x, i, rgb, j,
				img = this.img.data,	
				view;

			frame = this.frames.shift();

			if (frame) {
				view = new Uint32Array(frame);
				for (i = 0; i < view.length; i += 5) {
					y = view[i];
					x = view[i + 1];
					j = 4 * (y * this.info.width + x);
					img[j] = view[i+2];
					img[j+1] = view[i+3];
					img[j+2] = view[i+4];
					img[j+3] = 255;			
				}
				this.context.putImageData(this.img, 0, 0);
			}
		}

	}


	// export
	return Constructor;
}());
