importScripts("https://raw.github.com/lo1tuma/theorajs/master/build/theorajs-0.1.js");    

	// dependencies
var	decoder = TheoraJS.Theora.decoder,
	TransportStream = TheoraJS.Ogg.TransportStream,
	AjaxStream = TheoraJS.Stream.AjaxStream,
	isTheora = TheoraJS.Theora.header.isTheora,
	util = TheoraJS.namespace("Theora").util,

	// ...
	stream,
	running = false,
	divy = 1,
	divx = 1;

     


onmessage = function(event) {
	var msg = event.data;
	
	if (msg.type !== "command") {
		return;
	}

	switch (msg.command) {
		case "init":
			initStream(msg.url);
			break;
		case "decode":
			decode();
			break;
		case "pause":
			pause();
			break;
		default:
			postMessage("Unknown command");
			break;
	}

};

function initStream(url) {
	var fileStream = new AjaxStream(url),
		ogg,
		logicalStreams,
		theoraStream,
		i,
		retData;

	fileStream.fetch(function () {
		ogg = new TransportStream(fileStream);
		logicalStreams = ogg.findLogicalStreams();

		for (i = 0; i < logicalStreams.length; i += 1) {
			if (isTheora(logicalStreams[i].initialPacket)) {
				theoraStream = logicalStreams[i];
				break;
			}
		}

		if (!theoraStream) {
			// no theora stream found
			postMessage({type: "error", message: "Invalid input file."});
			nsIWorkerScope.close();
			return;
		}

		stream = theoraStream;
		decoder.setInputStream(stream);
		if (decoder.pixelFormat === 0) {
			divx = 2;
			divy = 2;
		} else if(decoder.pixelFormat === 2) {
			divx = 2;
		}
		retData = {
			width: decoder.width,
			height: decoder.height,
			framerate: decoder.framerate
		};
		postMessage({type: "success", data: retData});
		
	});
}

function sendFrame (frame) {
	var row,
		col,
		pixelX,
		pixelY,
		rgb,
		i,
		j = 0,
		len = frame.changedPixels.length,
		buf = new ArrayBuffer(20 * len),
		view = new Uint32Array(buf);

	for (i = 0; i < len; i+= 1) {
		col = frame.changedPixels[i][0];
		row = frame.changedPixels[i][1];

		// skip pixels outside the picture region
		if (col <= decoder.xOffset || row <= decoder.yOffset) {
			continue;
		}
		
		pixelX = col - decoder.xOffset;
		pixelY = decoder.height - (row - decoder.yOffset) - 1;

		rgb = util.yCbCrToRGB(frame.recy[row][col], frame.reccb[(row/divy)|0][(col/divx)|0], frame.reccr[(row/divy)|0][(col/divx)|0]);
		view[j] = pixelY;
		view[j+1] = pixelX;
		view[j+2] = rgb[0];
		view[j+3] = rgb[1];
		view[j+4] = rgb[2];

		j += 5;
	}

	webkitPostMessage({type: "data", frame: view.buffer}, [view.buffer]);
}

function decode() {
	var interval;

	running = true;

	setInterval(function () {
		var frame;

		if (!running) {
			clearInterval(interval);
		}

		frame = decoder.nextFrame();
		if (frame) {
			sendFrame(frame);
		} else {
			clearInterval(interval);
			postMessage({type: "eos"});
			close();
		}
	}, 1);

}

function pause() {
	running = false;
}
