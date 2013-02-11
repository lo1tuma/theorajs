TheoraJS.namespace("Stream").AjaxStream = (function () {
	"use strict";

		// dependencies
	var byteStream = TheoraJS.namespace("Stream").ByteStream,

		// private variables
		Constructor,

		// private methods
		fetch = function (url, callback) {
			// to-do: ajax: cross browser compatibility
			var req = new XMLHttpRequest();

			// XHR binary charset
			req.overrideMimeType('text/plain; charset=x-user-defined');
			req.open('GET', url, true);

			req.onreadystatechange = function () {
				if (req.readyState === 4) {
					if (typeof callback === "function") {
						callback(req.responseText);
					}
				}
			};

			req.send(null);
		};

	/**
	 * Load a remote binary file using ajax.
	 *
	 * @class AjaxStream
	 * @namespace Stream
	 * @param {String} url Url which should be fetched.
	 * @constructor
	 * @extends ByteStream
	 */
	Constructor = function (url) {
		// to-do: read data chunk-wise
		this.url = url;
		// call super constructor
		Constructor.uber.constructor.call(this);
	};

	// inheritance
	TheoraJS.inherit(Constructor, byteStream);

	// reset constructor reference
	Constructor.prototype.constructor = TheoraJS.namespace("Stream").AjaxStream;

	/**
	 * fetch
	 * 
	 * @method fetch
	 * @param {Function} callback
	 */
	Constructor.prototype.fetch = function (callback) {
		var self = this;
		fetch(this.url, function (data) {
			self.setData(data);
			callback();
		});
	};

	return Constructor;
}());
