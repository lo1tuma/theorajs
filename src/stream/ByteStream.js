TheoraJS.namespace("Stream").ByteStream = (function () {
	"use strict";

	var Constructor;

	/**
	 * ByteStream
	 *
	 * @class ByteStream
	 * @namespace Stream
	 * @param {String} data Binary data string
	 * @constructor
	 */
	Constructor = function () {
		this.index = 0;
		this.isReady = false;
		this.length = 0;
	};

	// public API -- prototype
	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.namespace("Stream").ByteStream,

		/**
		 * Set the data.
		 *
		 * @method setData
		 * @param {String} data
		 */
		setData: function (data) {
			this.data = data;
			this.length = data.length;
		},

		/**
		 * Get the next 8-bit value.
		 *
		 * @method next8
		 * @return {Number}
		 */
		next8: function () {
			var val = this.data.charCodeAt(this.index) & 0xff;

			this.index += 1;
			return val;
		},

		/**
		 * Get the next 16-bit value.
		 *
		 * @method next16
		 * @param {Boolean} [littleEndian=false] Defines the byte-order
		 * @return {Number}
		 */
		next16: function (littleEndian) {
			var b1 = this.next8(),
				b2 = this.next8();

			if (littleEndian) {
				return (b2 << 8) | b1;
			}

			return (b1 << 8) | b2;
		},

		/**
		 * Get the next 24-bit value.
		 *
		 * @method next24
		 * @param {Boolean} [littleEndian=false] Defines the byte-order
		 * @return {Number}
		 */
		next24: function (littleEndian) {
			var b1 = this.next8(),
				b2 = this.next8(),
				b3 = this.next8();

			if (littleEndian) {
				return (b3 << 16) | (b2 << 8) | b1;
			}

			return (b1 << 16) | (b2 << 8) | b3;
		},

		/**
		 * Get the next 32-bit value.
		 *
		 * @method next32
		 * @param {Boolean} [littleEndian=false] Defines the byte-order
		 * @return {Number}
		 */
		next32: function (littleEndian) {
			var b1 = this.next8(),
				b2 = this.next8(),
				b3 = this.next8(),
				b4 = this.next8();

			if (littleEndian) {
				return (b4 << 24) | (b3 << 16) | (b2 << 8) | b1;
			}

			return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
		},

		/**
		 * Get the next 64-bit value.  
		 * Javascript can't handle 64bit integers and all bit operations are performed with 32-bit arithmetic.
		 * Therefore this method will return an object with 2 values, lowBits and highBits.
		 *
		 * @method next64
		 * @param {Boolean} [littleEndian=false] Defines the byte-order
		 * @return {Object}
		 */
		next64: function (littleEndian) {
			var b1 = this.next8(),
				b2 = this.next8(),
				b3 = this.next8(),
				b4 = this.next8(),
				b5 = this.next8(),
				b6 = this.next8(),
				b7 = this.next8(),
				b8 = this.next8();

			if (littleEndian) {
				return {
					lowBits: ((b4 << 24) | (b3 << 16) | (b2 << 8) | b1),
					highBits: ((b8 << 24) | (b7 << 16) | (b6 << 8) | b5)
				};
			}

			return {
				lowBits: ((b5 << 24) | (b6 << 16) | (b7 << 8) | b8),
				highBits: ((b1 << 24) | (b2 << 16) | (b3 << 8) | b4)
			};
		},

		/**
		 * Generates a byte array of a specified number of values.  
		 * If there are not enough values left, the maximum of available values will be returned.
		 * 
		 * @method nextArray
		 * @param {Number} n Numer of values
		 * @return {Array}
		 */
		nextArray: function (n) {
			var bytes = [],
				i;

			// check if n is out of boundaries
			if ((this.index + n) >= this.length) {
				n = this.length - this.index;
			}

			for (i = 0; i < n; i += 1) {
				bytes[i] = this.next8();
			}
			return bytes;
		},

		/**
		 * Skip a specified number of 8-bit values.
		 *
		 * @method skip
		 * @param {Number} n Number of values.
		 */
		skip: function (n) {
			this.index += n;
		}
	};

	return Constructor;

}());
