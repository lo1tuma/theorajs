TheoraJS.namespace("Ogg").Packet = (function () {
	"use strict";

	var Constructor;

	/**
	 * Represents a logical ogg packet.
	 *
	 * @class Packet
	 * @namespace Ogg
	 * @constructor
	 */
	Constructor = function () {
		this.data = [];
		this.offset = 0;
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.namespace("Ogg").Packet,

		/**
		 * Adds a segment.
		 *
		 * @method addSegment
		 * @param {Array} segment Data array of the segment
		 */
		addSegment: function (segment) {
			if (segment.length === 0) {
				// don't add zero length segments
				return;
			}
			this.data = this.data.concat(segment);
		},

		/**
		 * Get the length of the packet
		 *
		 * @method getLength
		 * @return {Number}
		 */
		getLength: function () {
			return this.data.length;
		},

		/**
		 * Gets next 8-bit value.
		 *
		 * @method next8
		 * @return {Number}
		 */
		next8: function () {
			var val = this.data[this.offset];
			this.offset += 1;
			return val;
		},

		/**
		 * Gets next 16-bit value.
		 *
		 * @method next16
		 * @return {Number}
		 */
		next16: function () {
			return (this.next8() << 8) | this.next8();
		},

		/**
		 * Gets next 24-bit value.
		 *
		 * @method next24
		 * @return {Number}
		 */
		next24: function () {
			return (this.next8() << 16) | this.next16();
		},

		/**
		 * Gets next 32-bit value.
		 *
		 * @method next32
		 * @return {Number}
		 */
		next32: function () {
			return (this.next8() << 24) | this.next24();
		},

		/**
		 * Get a 8-bit value of a specified offset.
		 *
		 * @method get8
		 * @param {Number} i offset
		 * @return {Number}
		 */
		get8: function (i) {
			return this.data[i];
		},

		/**
		 * Skips a specified number of bytes.
		 *
		 * @method skip
		 * @param {Number} n Bytes to skip.
		 */
		skip: function (n) {
			this.offset += n;
		},

		/**
		 * Seeks to a specified position.
		 *
		 * @method seek
		 * @param {Number} pos Position
		 */
		seek: function (pos) {
			this.offset = pos;
		}
	};

	return Constructor;
}());
