'use strict';

window.onload = function() {
	var date,
		startTime,
		stopTime,
		player;

	player = new TheoraPlayer('../demo/test-videos/320x240.ogg', "test", "https://raw.github.com/lo1tuma/theorajs/master/src/Worker.js",
		function startClb() {
			date = new Date();
			startTime = date.getTime();
		},

		function stopClb(frameCnt, framerate) {
			date = new Date();
			stopTime = date.getTime();
			document.getElementById("info").innerHTML = "Elapsed time: " + ((stopTime - startTime) / 1000) + " s<br>" +
			"average framerate: " + (frameCnt / ((stopTime - startTime) / 1000)) + "<br>" + 
			"video framerate: " + framerate + "<br>" +
			"frames: " + frameCnt;
		}
	);
};
