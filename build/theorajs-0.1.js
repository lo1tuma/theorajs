/**
 * Theora.js implements an ogg reader and a theora video decoder.
 *
 * @module TheoraJS
 * @class TheoraJS
 * @main TheoraJS
 */
var TheoraJS = {};

(function () {
	"use strict";

	/**
	 * Provides a namespace.  
	 * An existing namespace won't be re-created.
	 *

		var module = TheoraJS.namespace("MyModule.MySubModule");

	 * @method namespace
	 * @param {String} namespace Namespace specifier
	 * @static
	 */
	TheoraJS.namespace = function (namespace) {
		var parts = namespace.split("."),
			parent = TheoraJS,
			i;

		// strip redundant leading global
		if (parts[0] === "TheoraJS") {
			parts = parts.slice(1);
		}

		for (i = 0; i < parts.length; i += 1) {
			// create a property if it doesn't exist
			if (typeof parent[parts[i]] === "undefined") {
				parent[parts[i]] = {};
			}
			parent = parent[parts[i]];
		}

		return parent;
	};

	/**
	 * Mixes all obj2 members into obj1.
	 *
	 * @method mixin
	 * @static
	 * @param {Object} obj1
	 * @param {Object} obj2
	 */
	TheoraJS.mixin = function (obj1, obj2) {
		var member;

		for (member in obj2) {
			if (obj2.hasOwnProperty(member)) {
				if (!obj1.hasOwnProperty(member)) {
					obj1[member] = obj2[member];
				}
			}
		}
	};

	/**
	 * Inherits parents prototype to the child
	 *
	 * @method inherit
	 * @param {Function} child
	 * @param {Function} parent
	 * @static
	 */
	TheoraJS.inherit = (function () {
		var F = function () {};
		return function (child, parent) {
			F.prototype = parent.prototype;
			child.prototype = new F();
			child.uber = parent.prototype;
			child.uber.constructor = parent;
			child.prototype.constructor = child;
		};
	}());

}());

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

/**
 * The Ogg module provides all classes and functionality for reading an ogg file container.
 *
 * @module Ogg
 * @main Ogg
 * @namespace TheoraJS
 */
TheoraJS.namespace("Ogg");

TheoraJS.namespace("Ogg").Page = (function () {
	"use strict";

	var Constructor;

	/**
	 * Represents a single ogg page.
	 *
	 * @class Page
	 * @namespace Ogg
	 * @constructor
	 * @param {Stream.ByteStream} stream
	 */
	Constructor = function (stream) {
		var i;

		this.stream = stream;

		/**
		 * Ogg capture pattern. Bytes 1-4, must be 'OggS'.
		 *
		 * @property capturePattern
		 * @type String
		 */
		this.capturePattern = String.fromCharCode(stream.next8(), stream.next8(), stream.next8(), stream.next8());

		// check for valid ogg page
		if (!this.isValid()) {
			throw {name: "OggError", message: "Page has invalid capturePattern."};
		}

		/**
		 * Stream structure version.
		 *
		 * @property version
		 * @type Number
		 */
		this.version = stream.next8();

		/**
		 * The header type flag identifies this page's context in the bitstream.
		 *
		 * @property headerType
		 * @type Number
		 */
		this.headerType = stream.next8();

		/**
		 * The absolute granule position is a special value (64-bit) used for seeking. The specific value is determined by the codec.  
		 * granulePosition has two 32-bit values lowBits and highBits (see {{#crossLink "ByteStrean/next64"}}{{/crossLink}}))
		 *
		 * @property granulePosition
		 * @type Object 
		 */
		this.granulePosition = stream.next64(true);

		/**
		 * The serial number is used to determine to which logical stream the page belongs to.
		 *
		 * @property serialNumber
		 * @type Number
		 */
		this.serialNumber = stream.next32(true);

		/**
		 * Page counter. Lost Pages can be detect with this counter.
		 *
		 * @property pageSequenceNumber
		 * @type Number
		 */
		this.pageSequenceNumber = stream.next32(true);

		/**
		 * 32 bit CRC checksum.
		 *
		 * @property checksum
		 * @type Number
		 */
		this.checksum = stream.next32(true);

		/**
		 * The number of segment entries to appear in the segment table
		 *
		 * @property pageSegments
		 * @type Number
		 */
		this.pageSegments = stream.next8();

		/**
		 * The lacing values for each packet segment.
		 *
		 * @property segmentTable
		 * @type Array
		 */
		this.segmentTable = [];

		/**
		 * Array of all segments data.  
		 * Each value represents the data of a single segment. The data is a bytewise array.
		 *
		 * @property segments
		 * @type Array
		 */
		this.segments = [];

		/**
		 * Length of the ogg page header in bytes.
		 *
		 * @property headerLength
		 * @type Number
		 */
		this.headerLength = 27 + this.pageSegments;

		/**
		 * Length of the ogg page body in bytes.
		 *
		 * @property bodyLength
		 * @type Number
		 */
		this.bodyLength = 0;

		// read the segment table
		for (i = 0; i < this.pageSegments; i += 1) {
			this.segmentTable[i] = stream.next8();
			this.bodyLength += this.segmentTable[i];
		}

		// read all segments
		for (i = 0; i < this.pageSegments; i += 1) {
			this.segments.push(this.stream.nextArray(this.segmentTable[i]));
		}
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.Ogg.Page,

		/**
		 * Checks if the page has a valid capturePattern.
		 *
		 * @method isValid
		 * @return {Boolean}
		 */
		isValid: function () {
			return this.capturePattern === "OggS";
		},

		/**
		 * Checks if the page is a continued page or the first page within a logical stream.
		 *
		 * @method isContinuedPage
		 * @return {Boolean}
		 */
		isContinuedPage: function () {
			// check bit flag
			return (this.headerType & 0x01) === 0x01;
		},

		/**
		 * Checks if the page is the last page within a logical stream.
		 *
		 * @method isEndOfStream
		 * @return {Boolean}
		 */
		isEndOfStream: function () {
			// check bit flag
			return (this.headerType & 0x04) === 0x04;
		},

		/**
		 * Checks if the page is the first page within a logical stream.
		 *
		 * @method isBeginOfStream
		 * @return {Boolean}
		 */
		isBeginOfStream: function () {
			// check bit flag
			return (this.headerType & 0x02) === 0x02;
		}
	};

	return Constructor;
}());

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

TheoraJS.namespace("Ogg").LogicalStream = (function () {
	"use strict";

		// dependencies
	var Packet = TheoraJS.namespace("Ogg.Packet"),

		// private variables
		Constructor;

	/**
	 * The logical stream is a specific demultiplexed stream of an ogg container.
	 *
	 * @class LogicalStream
	 * @namespace Ogg
	 * @constructor
	 * @param {Ogg.TransportStream} transportStream
	 * @param {Ogg.Page} firstPage
	 */
	Constructor = function (transportStream, firstPage) {
		if (!firstPage.isBeginOfStream()) {
			throw {name: "OggError", message: "LogicalStream must be initialized with a BeginOfStream page."};
		}

		this.stream = transportStream;

		/**
		 * Serial number of the logical stream
		 *
		 * @property serialNumber
		 * @type Number
		 */
		this.serialNumber = firstPage.serialNumber;

		// page counter for the last page
		this.lastPageNumber = firstPage.pageSequenceNumber;

		this.currentPage = firstPage;
		this.segmentOffset = 0;
		this.initialPacket = this.nextPacket();

		// reset offset, so we can re-read the initial packet with nextPacket()
		this.segmentOffset = 0;
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.namespace("Ogg").LogicalStream,

		/**
		 * Gets the next packet.
		 *
		 * @method nextPacket
		 * @return {Ogg.Packet}
		 */
		nextPacket: function () {
			var packet = new Packet(),
				segment;

			segment = this.nextSegment();
			if (!segment) {
				return false;
			}

			// add segments to the current packet
			// a segment length < 255 means it is the last segment of the current packet
			while (segment.length === 255) {
				packet.addSegment(segment);
				segment = this.nextSegment(true);
				if (!segment) {
					throw {name: "OggError", message: "Missing EndOfPacket segment"};
				}
			}

			// add last segment
			packet.addSegment(segment);

			return packet;
		},

		/**
		 * Gets the next segment
		 *
		 * @method nextSegment
		 * @private
		 * @param {Boolean} [checkForContinuation=false] If true, check if continuation bit flag is
		 *	set to the page, in case of a page spanning packet.
		 * @return {Array}
		 */
		nextSegment: function (checkForContinuation) {
			var ret,
				segment;

			// check for pagebreak
			if (this.segmentOffset >= this.currentPage.pageSegments) {
				// continue reading on next page
				ret = this.nextPage();
				if (!ret) {
					// End of stream and end of packet reached
					return false;
				}

				if (checkForContinuation) {
					// check for continuation bit flag
					if (!this.currentPage.isContinuedPage()) {
						throw {name: "OggError", message: "Page is not a continud page."};
					}
				}

				this.segmentOffset = 0;
			}

			segment = this.currentPage.segments[this.segmentOffset];
			this.segmentOffset += 1;

			return segment;
		},

		/**
		 * Gets next page within the logical stream.
		 *
		 * @method nextPage
		 * @private
		 * @return {Ogg.Page}
		 */
		nextPage: function () {
			var page;

			if (this.currentPage.isEndOfStream()) {
				return false;
			}

			// reading pages until we will find a page which belongs to this logical stream
			do {
				page = this.stream.nextPage();
			} while (page.serialNumber !== this.serialNumber && !page.isEndOfStream());

			// check if there is a lost page
			if ((page.pageSequenceNumber - 1) !== this.lastPageNumber) {
				throw {name: "OggError", message: "Lost data; missing page."};
			}

			this.lastPageNumber = page.pageSequenceNumber;
			this.currentPage = page;

			return true;
		}
	};

	return Constructor;
}());

TheoraJS.namespace("Ogg").TransportStream = (function () {
	"use strict";

		// dependencies
	var LogicalStream = TheoraJS.namespace("Ogg.LogicalStream"),
		Page = TheoraJS.namespace("Ogg.Page"),

		// private variables
		Constructor;

	/**
	 * The transport stream is the multiplexed physical stream of an ogg container.
	 *
	 * @class TransportStream
	 * @namespace Ogg
	 * @constructor
	 * @param {Stream.ByteStream} stream
	 */
	Constructor = function (stream) {
		this.byteStream = stream;
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.namespace("Ogg").TransportStream,

		/**
		 * Lookup for all logical ogg streams.  
		 *   
		 * Note: This method uses a lazy function definition, so avoid references to this method.
		 *
		 * @method findLogicalStreams
		 * @return {Array} Array of all LogicalStream instances.
		 */
		findLogicalStreams: function () {
			var page;
			this.logicalStreams = [];

			// lookup for all logical streams
			// a logical stream is identified by a ogg page where the BeginOfStream flag is true
			// all BeginOfStream pages have to be in order, before any other page follows
			page = this.nextPage();
			while (page.isBeginOfStream()) {
				this.logicalStreams.push(new LogicalStream(this, page));
				page = this.nextPage();
			}

			//unread last page, because it was't a BoS page
			this.byteStream.skip(-(page.headerLength + page.bodyLength));

			// override this method, because we have to do this work only once
			// to-do: check, if works... ?!
			Constructor.prototype.findLogicalStreams = function () {
				return this.logicalStreams;
			};

			return this.logicalStreams;
		},

		/**
		 * Get the next page in the transport stream.
		 *
		 * @method nextPage
		 * @return {Ogg.Page}
		 */
		nextPage: function () {
			// to-do: check if there are more pages available
			return new Page(this.byteStream);
		}
	};

	return Constructor;
}());

TheoraJS.namespace("Theora");

/**
 * Collection of some helper functions.
 *
 * @submodule util
 * @class util
 * @namespace Theora
 * @static
 */
TheoraJS.namespace("Theora").util = (function () {
	"use strict";

	var Bitstream,
		yCbCrToRGB;

	/**
	 * Converts a YCbCr value to RGB.
	 *
	 * @method yCbCrToRGB
	 * @param {Number} y
	 * @param {Number} cb
	 * @param {Number} cr
	 * @return {Array} r, g, b
	 */
	yCbCrToRGB = (function () {
		var rgbCache = [],
			yOutCache = [],
			pCache = [],
			i,
			j;

		// init and pre-compute caches
		for (i = 0; i < 256; i += 1) {
			rgbCache[i] = [];
			yOutCache[i] = (i - 16) / 219;
			pCache[i] = (i - 128) / 224;
			for (j = 0; j < 256; j += 1) {
				rgbCache[i][j] = [];
			}
		}

		return function (y, cb, cr) {
			var yOut = yOutCache[y],
				pb = pCache[cb],
				pr = pCache[cr],
				r,
				g,
				b;

			// if we have no entry in the cache
			// we have to compute the r,g,b values
			if (!rgbCache[y][cb][cr]) {
				r = yOut + 1.402 * pr;
				g = (yOut -  0.344136286 * pb) - 0.714136286 * pr;
				b = yOut + 1.772 * pb;

				// clamp
				if (r >= 1) {
					r = 1;
				} else if (r < 0) {
					r = 0;
				}
				if (g >= 1) {
					g = 1;
				} else if (g < 0) {
					g = 0;
				}
				if (b >= 1) {
					b = 1;
				} else if (b < 0) {
					b = 0;
				}

				r = ~~(r * 255);
				g = ~~(g * 255);
				b = ~~(b * 255);

				rgbCache[y][cb][cr] = [r, g, b];
			}

			return rgbCache[y][cb][cr];
		};
	}());

	/**
	 * Extracts the sign of a Number
	 *
	 * @method sign
	 * @param {Number} val
	 * @return {Number} -1 or 1
	 */
	function sign(val) {
		return val < 0 ? -1 : 1;
	}

	/**
	 * Converts any Number to Integer.
	 *
	 * @method toInt
	 * @param {Number} val
	 * @return {Number}
	 */
	function toInt(val) {
		return val | 0;
	}

	/**
	 * Converts any Number to an unsigned Integer.
	 *
	 * @method toUInt
	 * @param {Number} val
	 * @return {Number}
	 */
	function toUInt(val) {
		return Math.abs(val | 0);
	}

	/**
	 * Converts any Number to short (16-bit).
	 *
	 * @method toShort
	 * @param {Number} val
	 * @return {Number}
	 */
	function toShort(val) {
		if (val >= 32768) {
			return 32768;
		}
		if (val <= -32768) {
			return -32768;
		}
		return val;
	}

	/**
	 * The minimum number of bits required to store a positive integer a in two’s complement notation, or 0 for a non-positive integer a.
	 *
	 * @method ilog
	 * @param {Number} val
	 * @return {Number}
	 */
	function ilog(val) {
		var ret = 0;

		while (val !== 0) {
			ret += 1;
			val >>>= 1;
		}

		return ret;
	}

	/**
	 * Invert the key => value of a
	 *
	 * @method arrayFlip
	 * @param {Array} a
	 * @return {Array}
	 */
	function arrayFlip(a) {
		var key,
			b = [];

		for (key in a) {
			if (a.hasOwnProperty(key)) {
				b[a[key]] = +key;
			}
		}

		return b;
	}


	/**
	 * Bitstream reader class for bit unpacking. 
	 * Reads a ogg packet bitwise.
	 *
	 * @class Bitstream
	 * @namespace Theora.Util
	 * @constructor
	 * @param {Ogg.Packet} packet
	 * @param {Number} offset Bytes to skip
	 */
	Bitstream = function (packet, offset) {
		this.packet = packet;
		this.packet.seek(offset);

		// number of bits already read
		this.bits = 0;

		// 16-bit lookup buffer
		this.lookup = packet.next16();

		// end of stream flag
		this.eos = false;
	};

	Bitstream.prototype = {
		// reset constructor reference
		constructor: Bitstream,

		/**
		 * Reads n bits.
		 *
		 * @method nextBits
		 * @param {Number} n Number of bits, max 32 bits.
		 * @return {Number}
		 */
		nextBits: function (n) {
			if (n === 0) {
				// zero-bit integers will be handled as a '0' value
				return 0;
			}

			if (n <= 8) {
				return this.readBits(n);
			}
			if (n <= 16) {
				return this.readBits(8) << (n - 8) | this.readBits(n - 8);
			}
			if (n <= 24) {
				return this.readBits(8) << (n - 16) | this.readBits(8) << (n - 8) | this.readBits(n - 16);
			}
			if (n <= 32) {
				return this.readBits(8) << (n - 24) | this.readBits(8) << (n - 16) | this.readBits(8) << (n - 8) | this.readBits(n - 24);
			}

			throw {name: "TheoraError", message: "Bitstream can only read 0-32 bits at one time."};
		},

		/**
		 * Reads n bits and returns an unsigned value.
		 *
		 * @method nextUBits
		 * @param {Number} n Number of bits, max 32 bits.
		 * @return {Number} unsigned
		 */
		nextUBits: function (n) {
			return Math.abs(this.nextBits(n));
		},

		/**
		 * Reads n bits and update the lookup buffer. 
		 *  
		 * The lookup is on every moment up to date, this means the bits (starting at bit 0) isn’t read yet 
		 * after read n bit from the lookup, the lookup will be shifted n bits to the left 
		 * if the last byte contains only trash we will replace it with new data.
         *
		 * @method nextBits
		 * @private
		 * @param {Number} n Number of bits, max 8 bits.
		 * @return {Number}
		 */
		readBits: function (n) {
				// return value
			var val,

				// number of bits to the next octet
				trash;

			// extract the data
			val = this.lookup >>> (16 - n);

			// check if we have 8 or more bits read,
			// if so shift lookup only to the next octet boundary and fetch new data
			if ((this.bits + n) >= 8 && !this.eos) {
				// bits to the next octet boundary
				trash = 8 - this.bits;

				this.lookup <<= trash;

				// try to get new data
				try {
					this.lookup |= this.packet.next8();
				} catch (err) {
					// no more new data exists, but there could be valid data in the lookup buffer
					this.eos = true;
				}

				// shift remaing bits
				this.lookup <<= (n - trash);
				this.bits = n - trash;
			} else {
				// check if there are n bits available
				if (this.eos && n > (16 - this.bits)) {
					throw {name: "TheoraError", message: "Bitstream: End of Stream"};
				}

				this.lookup <<= n;
				this.bits += n;
			}

			// set all bits above the 16th to zero, 
			// this is necessary because js is a typeless language.
			// Bit operations are executed in a 32-bit context 
			this.lookup &= 0xFFFF;

			return val;
		}
	};

	// export public members and methods
	return {
		Bitstream: Bitstream,
		toInt: toInt,
		toUInt: toUInt,
		toShort: toShort,
		ilog: ilog,
		arrayFlip: arrayFlip,
		sign: sign,
		yCbCrToRGB: yCbCrToRGB
	};
}());

TheoraJS.namespace("Theora").constants = (function () {
	"use strict";

	return {
		LONG_RUN_LENGTH_HUFFMAN_TABLE: [
			// huffman codes
			[
				// 1 bit
				[{rstart: 1, rbits: 0}],

				// 2 bits
				[{rstart: 2, rbits: 1}],

				// 3 bits
				[{rstart: 4, rbits: 1}],

				// 4 bits
				[{rstart: 6, rbits: 2}],

				// 5 bits
				[{rstart: 10, rbits: 3}],

				// 6 bits
				[{rstart: 18, rbits: 4}, {rstart: 34, rbits: 12}]
			],

			// offsets
			[0, 2, 6, 14, 30, 62]
		],

		SHORT_RUN_LENGTH_HUFFMAN_TABLE: [
			// huffman codes
			[
				// 1 bit
				[{rstart: 1, rbits: 1}],

				// 2 bits
				[{rstart: 3, rbits: 1}],

				// 3 bits
				[{rstart: 5, rbits: 1}],

				// 4 bits
				[{rstart: 7, rbits: 2}],

				// 5 bits
				[{rstart: 11, rbits: 2}, {rstart: 15, rbits: 4}]
			],

			// offsets
			[0, 2, 6, 14, 30]
		],

		MACRO_BLOCK_MODE_SCHEMES: [
			// no scheme for index 0
			null,

			// scheme 1
			[3, 4, 2, 0, 1, 5, 6, 7],

			// scheme 2
			[3, 4, 0, 2, 1, 5, 6, 7],

			// scheme 3
			[3, 2, 4, 0, 1, 5, 6, 7],

			// scheme 4
			[3, 2, 0, 4, 1, 5, 6, 7],

			// scheme 5
			[0, 3, 4, 2, 1, 5, 6, 7],

			// scheme 6
			[0, 5, 3, 4, 2, 1, 6, 7]
		],

		MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE: [
			// huffman codes
			[
				// 1 bits
				[0],

				// 2 bits
				[1],

				// 3 bits
				[2],

				// 4 bits
				[3],

				// 5 bits
				[4],

				// 6 bits
				[5],

				// 7 bits
				[6, 7]
			],

			// offsets
			[0, 2, 6, 14, 30, 62, 126, 254]
		],

		MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE: [
			// huffman codes
			[
				// 1 bits
				[],

				// 2 bits
				[],

				// 3 bits
				[0, 1, -1],

				// 4 bits
				[2, -2, 3, -3],

				// 5 bits
				[],

				// 6 bits
				[4, -4, 5, -5, 6, -6, 7, -7],

				// 7 bits
				[8, -8, 9, -9, 10, -10, 11, -11, 12, -12, 13, -13, 14, -14, 15, -15],

				// 8 bits
				[16, -16, 17, -17, 18, -18, 19, -19, 20, -20, 21, -21, 22, -22,
					23, -23, 24, -24, 25, -25, 26, -26, 27, -27, 28, -28, 29, -29, 30, -30, 31, -31]
			],

			// offsets
			[0, 0, 0, 6, 0, 40, 96, 224]
		],

		HUFFMAN_TABLE_GROUPS: [
			0, 1, 1, 1, 1, 1, 2, 2,
			2, 2, 2, 2, 2, 2, 2, 3,
			3, 3, 3, 3, 3, 3, 3, 3,
			3, 3, 3, 3, 4, 4, 4, 4,
			4, 4, 4, 4, 4, 4, 4, 4,
			4, 4, 4, 4, 4, 4, 4, 4,
			4, 4, 4, 4, 4, 4, 4, 4,
			4, 4, 4, 4, 4, 4, 4, 4
		],

		// Reference frame index for each conding mode
		REFERENCE_FRAME_INDICIES: [
			// INTER_NOMV mode => Previous frame reference
			1,

			// INTRA mode => no reference
			0,

			// INTER_MV mode => previous frame reference
			1,

			// INTER_MV_LAST mode => previous frame reference
			1,

			// INTER_MV_LAST2 mode => previous frame reference
			1,

			// INTER_GOLDEN_NOMV mode => golden frame reference
			2,

			// INTER_GOLDEN_MV mode => golden frame reference
			2,

			// INTER_MV_FOUR mode => previous frame reference
			1
		],

		DCPREDICTORS_WEIGHTS_AND_DIVISORS_TABLE: {
			"1000": {weights: [ 1,   0,  0,  0], divisor:   1},
			"0100": {weights: [ 0,   1,  0,  0], divisor:   1},
			"1100": {weights: [ 1,   0,  0,  0], divisor:   1},
			"0010": {weights: [ 0,   0,  1,  0], divisor:   1},
			"1010": {weights: [ 1,   0,  1,  0], divisor:   2},
			"0110": {weights: [ 0,   0,  1,  0], divisor:   1},
			"1110": {weights: [29, -26, 29,  0], divisor:  32},
			"0001": {weights: [ 0,   0,  0,  1], divisor:   1},
			"1001": {weights: [75,   0,  0, 53], divisor: 128},
			"0101": {weights: [ 0,   1,  0,  1], divisor:   2},
			"1101": {weights: [75,   0,  0, 53], divisor: 128},
			"0011": {weights: [ 0,   0,  1,  0], divisor:   1},
			"1011": {weights: [75,   0,  0, 53], divisor: 128},
			"0111": {weights: [ 0,   3, 10,  3], divisor:  16},
			"1111": {weights: [29, -26, 29,  0], divisor:  32}
		},

		ZIG_ZAG_ORDER_MAPPING_TABLE: [
			[0, 1, 5, 6, 14, 15, 27, 28],
			[2, 4, 7, 13, 16, 26, 29, 42],
			[3, 8, 12, 17, 25, 30, 41, 43],
			[9, 11, 18, 24, 31, 40, 44, 53],
			[10, 19, 23, 32, 39, 45, 52, 54],
			[20, 22, 33, 38, 46, 51, 55, 60],
			[21, 34, 37, 47, 50, 56, 59, 61],
			[35, 36, 48, 49, 57, 58, 62, 63]
		],

		// mapping table of the relative row position within a super block
		ROW_MAPPING_TABLE: [
			[
				// 1*1
				[0],

				// 1*2
				[0, 1],

				// 1*3
				[0, 1, 2],

				// 1*4
				[0, 1, 2, 3]
			],
			[
				// 2*1
				[0, 0],

				// 2*2
				[0, 0, 1, 1],

				// 2*3
				[0, 0, 1, 1, 2, 2],

				// 2*4
				[0, 0, 1, 1, 2, 3, 3, 2]
			],
			[
				// 3*1
				[0, 0, 0],

				// 3*2
				[0, 0, 1, 1, 1, 0],

				// 3*3
				[0, 0, 1, 1, 2, 2, 2, 1, 0],

				// 3*4
				[0, 0, 1, 1, 2, 3, 3, 2, 2, 3, 1, 0]
			],
			[
				// 4*1
				[0, 0, 0, 0],

				// 4*2
				[0, 0, 1, 1, 1, 1, 0, 0],

				// 4*3
				[0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0],

				// 4*4
				[0, 0, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 1, 1, 0, 0]
			]
		],

		COLUMN_MAPPING_TABLE: [
			[
				// 1*1
				[0],

				// 1*2
				[0, 0],

				// 1*3
				[0, 0, 0],

				// 1*4
				[0, 0, 0, 0]
			],
			[
				// 2*1
				[0, 1],

				// 2*2
				[0, 1, 1, 0],

				// 2*3
				[0, 1, 1, 0, 0, 1],

				// 2*4
				[0, 1, 1, 0, 0, 0, 1, 1]
			],
			[
				// 3*1
				[0, 1, 2],

				// 3*2
				[0, 1, 1, 0, 2, 2],

				// 3*3
				[0, 1, 1, 0, 0, 1, 2, 2, 2],

				// 3*4
				[0, 1, 1, 0, 0, 0, 1, 1, 2, 2, 2, 2]
			],
			[
				// 4*1
				[0, 1, 2, 3],

				// 4*2
				[0, 1, 1, 0, 3, 2, 2, 3],

				// 4*3
				[0, 1, 1, 0, 0, 1, 2, 3, 3, 2, 2, 3],

				// 4*4
				[0, 1, 1, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3]
			]
		],

		// Approximations of Sines and Cosines
		COSINES: [64277, 60547, 54491, 46341, 36410, 25080, 12785],
		SINES: [12785, 25080, 36410, 46341, 54491, 60547, 64277],

		// Intra Predictor
		INTRA_PREDICTOR: [
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128],
			[128, 128, 128, 128, 128, 128, 128, 128]
		]
	};
}());

/**
 * Collection of methods that generates all kind of mapping tables.
 *
 * @class mappingTables
 * @namespace Theora
 * @static
 */
TheoraJS.namespace("Theora").mappingTables = (function () {
	"use strict";

		// Dependencies
	var constants = TheoraJS.namespace("Theora").constants;

	/**
	 * Generates a array of the sizes of all super blocks for a specific color plane.
	 *
	 * @method computeSuperBlockSizes
	 * @param {Number} width Width of the color plane in blocks.
	 * @param {Number} height Height of the color plane in blocks.
	 * @return {Array} Array of super block sizes. 
	 */
	function computeSuperBlockSizes(width, height) {
			// Sizes of all super blocks
		var sizes = [],

			// Current super block row
			row,

			// Current super block column
			col,

			// Width in super blocks
			superBlocksWidth = (width - (width % 4)) / 4,

			// Height in super blocks
			superBlocksHeight = (height - (height % 4)) / 4,

			// Height of the current super blocks
			currentHeight = 4,

			// Height of the super blocks in the top row
			partialHeight = 4,

			// Width of the super blocks in the right column
			partialWidth = 4;

		// check if there are partial super blocks on the top or right edge
		if (superBlocksWidth < (width / 4)) {
			// calculate the with of each super block in the last column
			partialWidth = width - 4 * superBlocksWidth;

			// increase width of super blocks
			superBlocksWidth += 1;
		}
		if (superBlocksHeight < (height / 4)) {
			// calculate the height of each super block in the top row
			partialHeight = height - 4 * superBlocksHeight;

			// increase the height of super blocks
			superBlocksHeight += 1;
		}

		// iterating through the super block rows and cols of the plane
		for (row = 0; row < superBlocksHeight; row += 1) {

			// determine the height of the current super block,
			// which will be 4 except for the last row
			if (row < (superBlocksHeight - 1)) {
				currentHeight = 4;
			} else {
				currentHeight = partialHeight;
			}

			// iterating through each column of the row except the last
			for (col = 0; col < (superBlocksWidth - 1); col += 1) {
				sizes[row * superBlocksWidth + col] = currentHeight * 4;
			}
			// last super block in the current row,
			sizes[row * superBlocksWidth + col] = currentHeight * partialWidth;
		}

		return sizes;
	}

	/**
	 * Generates a mapping table for block indicies to their super block indicies.
	 * Super block indicies can be adjusted with a offset.
	 *
	 * @method computeBlockToSuperBlockTable
	 * @param {Number} width Width of the color plane in blocks.
	 * @param {Number} height Height of the color plane in blocks.
	 * @param {Array} sizes Array of super block sizes.
	 * @param {Number} [offset=0] Offset, to adjust the super block indicies by this specific value.
	 * @return {Array} Mapping table from block index to super block index.
	*/
	function computeBlockToSuperBlockTable(width, height, sizes, offset) {
			// block to super block mapping table
		var table = [],

			// number of the blocks in the plane
			numberOfBlocks = width * height,

			// block index in coded order
			bi,

			// index of the current super block
			sbi = 0,

			// block index of the first block in current super block
			firstBi = 0;

		// set offset to 0, if not defined
		offset = offset || 0;

		// loop through all blocks in coded order
		for (bi = 0; bi < numberOfBlocks; bi += 1) {

			// check if a new super block begins
			if ((bi - (firstBi + sizes[sbi])) === 0) {
				firstBi += sizes[sbi];
				sbi += 1;
			}

			// map bi to sbi
			table[bi] = sbi + offset;
		}

		return table;
	}

	/**
	 * Generates a mapping table for block indicies in raster order to coded order.
	 *
	 * @method computeRasterToCodedOrderMappingTable
	 * @param {Number} width Width of the color plane in blocks.
	 * @param {Number} height Height of the color plane in blocks.
	 * @param {Array} mappingTable Mapping table from block index to super block index.
	 * @param {Array} sizes Array of super block sizes.
	 * @param {Number} [offset=0] Offset, to adjust the coded block indicies by this specific value.
	 * @return {Array} Mapping table from block index in raster order to block index in coded order.
	*/
	function computeRasterToCodedOrderMappingTable(width, height, mappingTable, sizes, offset) {
			// Mapping table
		var table = [],

			// Index of the current block in coded order
			bi,

			// Index of the current super block
			sbi,

			// Total number of blocks
			numberOfBlocks = width * height,

			// Position of the row corresponding to the first block of the current super block
			row = 0,

			// Position of the col corresponding to the first block of the current super block
			col = 0,

			// Absolute position of the row of the current block
			blockRow,

			// Absolute position of the col of the current block
			blockCol,

			// Width of the current super block
			superBlockWidth = 4,

			// Height of the current super block
			superBlockHeight = 4,

			// Index of the first block corresponding to the current super block
			firstBi = 0,

			// Relative index of a block corresponding to a super block
			relativeBi = 0;

		// initialize sbi with the index of the super block corresponding to block 0
		sbi = mappingTable[offset];

		// adjust the dimensions of the first super block,
		// if it contains not all 16 block
		if (sizes[sbi] !== 16) {
			if (width < 4) {
				superBlockWidth = width;
			}
			if (height < 4) {
				superBlockHeight = height;
			}
		}

		// loop through all blocks in coded order
		for (bi = 0; bi < numberOfBlocks; bi += 1) {

			// check if a new super block begins
			if (mappingTable[offset + bi] > sbi) {

				// update the column of the first block in the current super block
				col += superBlockWidth;

				// check if we have to jump to the next row
				if (col >= width) {
					col = 0;
					row += superBlockHeight;
				}

				// update the block index of the first block in the current super block
				firstBi += sizes[sbi];

				// update the dimensions of the new super block
				if ((col + 4) <= width) {
					// normal super block width
					superBlockWidth = 4;
				} else {
					// partial super block, calculate the remaining blocks to the right edge
					superBlockWidth = width - col;
				}
				if ((row + 4) <= height) {
					// normal super block height
					superBlockHeight = 4;
				} else {
					// partial super block, calculate the remaining blocks to the top edge
					superBlockHeight = height - row;
				}

				// increase super block index
				sbi += 1;
			}

			// assign block index in coded order relative to the current super block
			relativeBi = bi - firstBi;

			// determine the absolute position of row and col
			// from the current block in the color plane
			blockRow = row + constants.ROW_MAPPING_TABLE[superBlockWidth - 1][superBlockHeight - 1][relativeBi];
			blockCol = col + constants.COLUMN_MAPPING_TABLE[superBlockWidth - 1][superBlockHeight - 1][relativeBi];

			// map the raster index to coded order bi
			table[blockRow * width + blockCol] = bi + offset;
		}

		return table;
	}

	/**
	 * Generates a mapping tables for block to macro block and macro block to block relations.
	 *
	 * @method computeMacroBlockMappingTables
	 * @param {Number} frameWidth Frame width in macro blocks.
	 * @param {Number} frameHeight Frame height in macro blocks.
	 * @param {Number} pixelFormat The pixel format, to determine the subsampling mode.
	 * @param {Array} rasterToCodedOrder Mapping table, that maps block indicies from raster order to coded order.
	 * @return {Array} Element 0 will be the block index to macro block index table. Element 1 will be the macro
	 *					block index to block index table. 
	 */
	function computeMacroBlockMappingTables(frameWidth, frameHeight, pixelFormat, rasterToCodedOrder) {
			// The mapping tables
		var tables = [],

			// The index of the current block in coded order
			bi = 0,

			// The index of the current block in raster order
			bri = 0,

			// The column of the current macro block
			col = 0,

			// The row of the current macro block
			row = 0,

			// Flag that indicates if the row of a macro blog is odd or even
			isOddRow = 0,

			// The index of the current macro block
			mbi = 0,

			// Width of a single macro block in blocks
			macroBlockWidth = 2,

			// Height of a single macro block in blocks
			macroBlockHeight = 2,

			// The index of the current color plane
			pli = 0,

			// The relative position of the macro block in its current row
			xOffset,

			// Iterators to loop through the dimensions of a macro block
			i,
			j;

		// Macro blocks will be accessed in coded order within a super block.
		// A super block contains 2*2 macro blocks. The lower-left has the index 0,
		// upper-left 1, upper-right 2 and lower-right 3.
		// To map the coded block indicies to the coded macro block indicies we will
		// iterate through the macro blocks in raster order.

		tables[0] = [];
		tables[1] = [];

		// For all color planes
		for (pli = 0; pli < 3; pli += 1) {

			// adjust some values if current plane is a chroma plane
			if (pli !== 0) {
				// change dimensions of macro blocks corresponding to the pixel format
				if (pixelFormat === 0) {
					// subsampling 4:2:0
					macroBlockWidth = 1;
					macroBlockHeight = 1;
				} else if (pixelFormat === 2) {
					// subsampling 4:2:2
					macroBlockWidth = 1;
					macroBlockHeight = 2;
				}
			}

			// For each row of macro blocks
			for (row = 0; row < frameHeight; row += 1) {

				// determine if the row is odd or even
				isOddRow = row % 2;

				// For each block row within a macro block
				for (i = 0; i < macroBlockHeight; i += 1) {

					// Start value of xOffset depends on the parity of the row
					xOffset = isOddRow;

					// For each column of macro blocks
					for (col = 0; col < frameWidth; col += 1) {

						// calculate the coded order index of the current macro block
						mbi = (row - isOddRow) * frameWidth + xOffset;

						// init, table entry if not exists
						if (typeof tables[1][mbi] === "undefined") {
							tables[1][mbi] = [];
						}

						// For each block column within a macro block
						for (j = 0; j < macroBlockWidth; j += 1) {

							// get the block index in coded order
							bi = rasterToCodedOrder[bri];

							// increase the block index in raster order
							bri += 1;

							// map bi to mbi
							tables[0][bi] = mbi;
							tables[1][mbi].push(bi);
						}

						// The next xOffset will be increased by 1,
						// if a new super block begins and 3 if we stay in the same super block.
						// If we are in the last row, where is a parital super block
						// we don’t have to use the coded order
						if (col % 2 === isOddRow && !(row === (frameHeight - 1) && isOddRow === 0)) {
							xOffset += 3;
						} else {
							xOffset += 1;
						}
					}
				}
			}
		}

		return tables;
	}

	// export public methods
	return {
		computeSuperBlockSizes: computeSuperBlockSizes,
		computeBlockToSuperBlockTable: computeBlockToSuperBlockTable,
		computeRasterToCodedOrderMappingTable: computeRasterToCodedOrderMappingTable,
		computeMacroBlockMappingTables: computeMacroBlockMappingTables
	};
}());

/**
 * Provides all functionallity to decode the three differente theora bitstream headers.
 *
 * @class header
 * @namespace Theora
 * @static
 */
TheoraJS.namespace("Theora").header = (function () {
	"use strict";

		// dependencies
	var util = TheoraJS.namespace("Theora").util,

		/* private */

		// A 64-element array of scale values for AC coefficients
		acScale = [],

		// A 64-element array of scale values for DC coefficients
		dcScale = [],

		// The number of base matrices
		nbms = 0,

		// A nbms*64 array containg all base matrices
		bms = [],

		// A 2*3 array containing the number of quant ranges for a given qti and pli
		nqrs = [],

		// A 2*3*63 array of the sizes of each quant range for a given qti and pli
		qrsizes = [],

		// A 2*3*64 array of the bmi’s used for each quant range for a given qti and pli
		qrbmis = [];

	/**
	 * Checks if the ogg packet is a theora header.
	 *
	 * @method isTheora
	 * @param {Ogg.Packet} packet
	 * @return {Boolean}
	 */
	function isTheora(packet) {
		// Bytes 1-6 have to be 'Theora'
		return (packet.get8(1) === 0x74 &&
				packet.get8(2) === 0x68 &&
				packet.get8(3) === 0x65 &&
				packet.get8(4) === 0x6F &&
				packet.get8(5) === 0x72 &&
				packet.get8(6) === 0x61);
	}

	/**
	 * Decode a 32-bit length value from packet in little endian order
	 *
	 * @method decodeCommentLength
	 * @private
	 * @param {Ogg.Packet}
	 * @return {Number} Length
	 */
	function decodeCommentLength(packet) {
		var len0 = packet.next8(),
			len1 = packet.next8(),
			len2 = packet.next8(),
			len3 = packet.next8();

		return len0 + (len1 << 8) + (len2 << 16) + (len3 << 24);
	}

	/**
	 * Quantization Parameters Decode
	 *
	 * @method decodeQuantizationParameters
	 * @private
	 * @param {util.BitStream} reader
	 */
	function decodeQuantizationParameters(reader) {
			// A quantization type index
		var qti,

			// A quantization type index
			qtj,

			// A color plane index
			pli,

			// A color plane index
			plj,

			// The quantization index
			qi,

			// The base matrix index
			bmi,

			// A base matrix index
			bmj,

			// The quant range index
			qri,

			// The size of fields to read
			nbits,

			// Flag that indicates a new set of quant ranges will be defined
			newqr,

			// Flag that indicates the quant ranges to copy
			rpqr;

		// get the acscale values
		nbits = reader.nextBits(4) + 1;
		for (qi = 0; qi < 64; qi += 1) {
			acScale[qi] = reader.nextUBits(nbits);
		}

		// get the dcscale values
		nbits = reader.nextBits(4) + 1;
		for (qi = 0; qi < 64; qi += 1) {
			dcScale[qi] = reader.nextUBits(nbits);
		}

		// get the number of base matrices
		nbms = reader.nextBits(9) + 1;
		if (nbms > 384) {
			throw {name: "TheoraError", message: "Number of base matrices is too high."};
		}

		// get the base matrices
		for (bmi = 0; bmi < nbms; bmi += 1) {
			bms[bmi] = [];
			for (bmj = 0; bmj < 64; bmj += 1) {
				bms[bmi][bmj] = reader.nextBits(8);
			}
		}

		for (qti = 0; qti < 2; qti += 1) {
			nqrs[qti] = [];
			qrsizes[qti] = [];
			qrbmis[qti] = [];

			for (pli = 0; pli < 3; pli += 1) {
				nqrs[qti][pli] = [];
				qrsizes[qti][pli] = [];
				qrbmis[qti][pli] = [];

				// init qrsizes and qrbmis
				for (qri = 0; qri < 64; qri += 1) {
					qrsizes[qti][pli][qri] = 0;
					qrbmis[qti][pli][qri] = 0;
				}

				newqr = 1;
				if (qti > 0 || pli > 0) {
					newqr = reader.nextBits(1);
				}

				if (newqr === 0) {
					// copying a previously defined set of quant ranges
					rpqr = 0;
					if (qti > 0) {
						rpqr = reader.nextBits(1);
					}
					if (rpqr === 1) {
						qtj = qti - 1;
						plj = pli;
					} else {
						qtj = util.toInt((3 * qti + pli - 1) / 3);
						plj = (pli + 2) % 3;
					}
					nqrs[qti][pli] = nqrs[qtj][plj];
					qrsizes[qti][pli] = qrsizes[qtj][plj];
					qrbmis[qti][pli] = qrbmis[qtj][plj];
				} else {
					// defining a new set of quant ranges
					qri = 0;
					qi = 0;

					qrbmis[qti][pli][qri] = reader.nextBits(util.ilog(nbms - 1));
					if (qrbmis[qti][pli][qri] >= nbms) {
						throw {name: "TheoraError", message: "Stream is undecodeable."};
					}

					while (qi < 63) {
						qrsizes[qti][pli][qri] = reader.nextBits(util.ilog(62 - qi)) + 1;
						qi += qrsizes[qti][pli][qri];
						qri += 1;
						qrbmis[qti][pli][qri] = reader.nextBits(util.ilog(nbms - 1));
					}
					if (qi > 63) {
						throw {name: "TheoraError", message: "Stream is undecodeable."};
					}
					nqrs[qti][pli] = qri;
				}
			}
		}

	}

	/**
	 * Loop Filter Limit Table Decode
	 *
	 * @method decodeLFLTable
	 * @private
	 * @param {util.BitStream} reader
	 * @return {Array} A 64-element array of loop filter limit values
	 */
	function decodeLFLTable(reader) {
			// The size of values being read in the current table
		var nbits,

			// The quantization index
			qi,

			// return value
			lflims = [];

		nbits = reader.nextBits(3);


		for (qi = 0; qi < 64; qi += 1) {
			//add nbit-bit value
			lflims[qi] = reader.nextBits(nbits);
		}

		return lflims;
	}

	/**
	 * Computing a Quantization Matrix
	 *
	 * @method computeQuantizationMatrix
	 * @param {Number} qti Quantization type index
	 * @param {Number} pli Color plane index
	 * @param {Number} qi Quantization index
	 * @return {Array} 64-element array of quantization values for each DCT coefficient in natural order
	 */
	function computeQuantizationMatrix(qti, pli, qi) {
			// quantization values for each DCT coefficient
		var qmat = [],

			// The quant range index
			qri,

			// The left end-point of the qi range
			qiStart = 0,

			// The right end-point of the qi range
			qiEnd = 0,

			// base matrix index
			bmi,

			// base matrix index
			bmj,

			// minimum quantization value allowed for the current coefficient
			qmin,

			// current scale value
			qscale,

			// The DCT coefficient index
			ci,

			// current value of the interpolated base matrix
			bm;

		// find qri where qi is >= qiStart and qi <= qiEnd
		for (qri = 0; qri < 63; qri += 1) {
			qiEnd += qrsizes[qti][pli][qri];
			if (qi <= qiEnd && qiStart <= qi) {
				break;
			}
			qiStart = qiEnd;
		}

		bmi = qrbmis[qti][pli][qri];
		bmj = qrbmis[qti][pli][qri + 1];
		for (ci = 0; ci < 64; ci += 1) {
			bm = util.toInt((2 * (qiEnd - qi) * bms[bmi][ci] + 2 * (qi - qiStart) * bms[bmj][ci] +
							qrsizes[qti][pli][qri]) / (2 * qrsizes[qti][pli][qri]));


			qmin = 16;
			if (ci > 0 && qti === 0) {
				qmin = 8;
			} else if (ci === 0 && qti === 1) {
				qmin = 32;
			}

			if (ci === 0) {
				qscale = dcScale[qi];
			} else {
				qscale = acScale[qi];
			}

			qmat[ci] = Math.max(qmin, Math.min((util.toInt((qscale * bm / 100)) * 4), 4096));
		}

		return qmat;
	}

	/**
	 * Recursive helper function to decode a huffman tree
	 *
	 * @method buildSubtree
	 * @private
	 * @param {String} hbits A Bit-string of up to 32 bits
	 * @param {util.BitStream} reader
	 * @param {Array} Huffman table
	 * @param {Number} Huffman table index
	 * @param {Number} numberOfHuffmanCodeds Current number of Huffman codes
	 */
	function buildSubtree(hbits, reader, hts, hti, numberOfHuffmanCodes) {
		// Flag that indicates if the current node of the tree being decoded is a leaf node
		var isLeaf,

			// A single DCT token value
			token;

		if (hbits.length > 32) {
			throw {name: "TheoraError", message: "Stream undecodeable."};
		}

		isLeaf = reader.nextBits(1);
		if (isLeaf === 1) {
			if (numberOfHuffmanCodes === 32) {
				throw {name: "TheoraError", message: "Stream undecodeable."};
			}

			token = reader.nextBits(5);
			hts[hti][hbits.length - 1][parseInt(hbits, 2)] = token;
			numberOfHuffmanCodes += 1;
			return numberOfHuffmanCodes;
		}

		hbits += '0';
		numberOfHuffmanCodes = buildSubtree(hbits, reader, hts, hti, numberOfHuffmanCodes);

		// remove last char
		hbits = hbits.slice(0, -1);
		hbits += '1';
		numberOfHuffmanCodes = buildSubtree(hbits, reader, hts, hti, numberOfHuffmanCodes);

		// remove last char
		hbits = hbits.slice(0, -1);
	}


	/**
	 * Decode all huffman tables.
	 *
	 * @method decodeHuffmanTables
	 * @private 
	 * @param {util.BitStream} reader
	 * @return {Array} 80-element array of Huffman tables with up to 32 entries each
	 */
	function decodeHuffmanTables(reader) {
			// return value
		var hts = [],

			// Huffman token index
			hti,

			i;

		for (hti = 0; hti < 80; hti += 1) {
			hts[hti] = [];
			for (i = 0; i < 32; i += 1) {
				hts[hti][i] = [];
			}

			buildSubtree("", reader, hts, hti, 0);
		}

		return hts;
	}

	// export public methods
	return {
		isTheora: isTheora,

		/**
		 * Decodes the identification header.
		 *
		 * @method decodeIdentificationHeader
		 * @param {Ogg.Packet} packet
		 */
		decodeIdentificationHeader: function (packet) {
				// The current header type
			var headerType = packet.get8(0),

				// temporary data for bit unpacking
				data;

			// check the headerType and the theora signature
			if (headerType !== 0x80 && !isTheora(packet)) {
				throw {name: "TheoraError", message: "Invalid identification header."};
			}

			// skip headerType and "theora" string (7 bytes)
			packet.seek(7);

			/**
			 * The major version number
			 *
			 * @property vmaj
			 */
			this.vmaj = packet.next8();

			/**
			 * The minor version number
			 *
			 * @property vmin
			 */
			this.vmin = packet.next8();

			/**
			 * The version revision number
			 *
			 * @property vrev
			 */
			this.vrev = packet.next8();

			/**
			 * The width of the frame in macro blocks
			 *
			 * @property fmbw
			 */
			this.fmbw = packet.next16();

			/**
			 * The height of the frame in macro blocks
			 *
			 * @property fmbh
			 */
			this.fmbh = packet.next16();

			/**
			 * The width of the picture region in pixels
			 *
			 * @property picw
			 */
			this.picw = packet.next24();

			/**
			 * The height of the picture region in pixels
			 *
			 * @property pich
			 */
			this.pich = packet.next24();

			/**
			 * The X offset of the picture region in pixels
			 *
			 * @property picx
			 */
			this.picx = packet.next8();

			/**
			 * The Y offset of the picture region in pixels
			 *
			 * @property picy
			 */
			this.picy = packet.next8();

			/**
			 * The frame-rate numerator
			 *
			 * @property frn
			 */
			this.frn = packet.next32();

			/**
			 * The frame-rate denominator
			 *
			 * @property frd
			 */
			this.frd = packet.next32();

			/**
			 * The pixel aspect-ratio numerator
			 *
			 * @property parn
			 */
			this.parn = packet.next24();

			/**
			 * The pixel aspect-ratio denominator
			 *
			 * @property pard
			 */
			this.pard = packet.next24();

			/**
			 * The color space
			 *
			 * @property cs
			 */
			this.cs = packet.next8();

			/**
			 * The nominal bitrate of the stream, in bits per second
			 *
			 * @property nombr
			 */
			this.nombr = packet.next24();

			// reading 6 bit quality hint, 5 bit kfgshift, 2 bit pixel format und 3 reserved bits
			data = packet.next16();

			/**
			 * The quality hint
			 *
			 * @property qual
			 */
			this.qual = data >> 10;

			/**
			 * The amount to shift the key frame number by in the granule position
			 *
			 * @property kfgshift
			 */
			this.kfgshift = (data >> 5) & 0x1F;

			/**
			 * The pixel format
			 *
			 * @property pf
			 */
			this.pf = (data >> 3) & 0x03;

			// reserved bits must be zero or we haven’t a valid stream
			if ((data & 0x07) !== 0) {
				throw {name: "TheoraError", message: "Invalid theora header"};
			}

			/**
			 * The number of macro blocks
			 *
			 * @property nmbs
			 */
			this.nmbs = this.fmbw * this.fmbh;

			/**
			 * The number of blocks in the luma plane
			 *
			 * @property nlbs
			 */
			this.nlbs = 4 * this.nmbs;

			/**
			 * Frame width of the luma plane in blocks
			 *
			 * @property flbw
			 */
			this.flbw = 2 * this.fmbw;

			/**
			 * Frame height of the luma plane in blocks
			 *
			 * @property flbh
			 */
			this.flbh = 2 * this.fmbh;

			// determine the correct number of blocks and super blocks corresponding to the pixel format
			// 0 = 4:2:0 subsampling
			// 2 = 4:2:2 subsampling
			// 3 = 4:4:4 subsampling
			switch (this.pf) {
			case 0:
				/**
				 * The number of super blocks
				 *
				 * @property nsbs
				 */
				this.nsbs = util.toInt((this.fmbw + 1) / 2) * util.toInt((this.fmbh + 1) / 2) +
							2 * util.toInt((this.fmbw + 3) / 4) * util.toInt((this.fmbh + 3) / 4);

				/**	
				 * The number of blocks
				 *
				 * @property nbs
				 */
				this.nbs = 6 * this.fmbw * this.fmbh;

				/**
				 * The number of blocks in each chroma plane
				 *
				 * @property ncbs
				 */
				this.ncbs = this.fmbw * this.fmbh;

				/**
				 * Frame width of each chroma plane in blocks
				 * 
				 * @property fcbw
				 */
				this.fcbw = this.fmbw;

				/**
				 * Frame height of each chroma plane in blocks
				 *
				 * @property fmbh
				 */
				this.fcbh = this.fmbh;

				break;
			case 2:
				// The number of super blocks
				this.nsbs = util.toInt((this.fmbw + 1) / 2) * util.toInt((this.fmbh + 1) / 2) +
							2 * util.toInt((this.fmbw + 3) / 4) * util.toInt((this.fmbh + 1) / 2);
					// The number of blocks
				this.nbs = 8 * this.fmbw * this.fmbh;

				// The number of blocks in each chroma plane
				this.ncbs = 2 * this.fmbw * this.fmbh;

				// Frame width of each chroma plane in blocks
				this.fcbw = this.fmbw;

				// Frame height of each chroma plane in blocks
				this.fcbh = 2 * this.fmbh;

				break;
			case 3:
				// The number of super blocks
				this.nsbs = 3 * util.toInt((this.fmbw + 1) / 2) * util.toInt((this.fmbh + 1) / 2);

				// The number of blocks
				this.nbs = 12 * this.fmbw * this.fmbh;

				// The number of blocks in each chroma plane
				this.ncbs = 4 * this.fmbw * this.fmbh;

				// Frame width of each chroma plane in blocks
				this.fcbw = 2 * this.fmbw;

				// Frame height of each chroma plane in blocks
				this.fcbh = 2 * this.fmbh;

				break;
			default:
				throw {name: "TheoraError", message: "Unkown pixel format."};
			}

		},

		/**
		 * Decodes the comment header.
		 *
		 * @method decodeCommentHeader
		 * @param {Ogg.Packet} packet
		 */
		decodeCommentHeader: function (packet) {
				// The current header type
			var headerType = packet.get8(0),

				// number of characters to read
				len,

				// number of comments
				ncomments,

				// current comment
				comment,

				// index of the current comment
				ci,

				i;

			// check the headerType and the theora signature
			if (headerType !== 0x81 && !isTheora(packet)) {
				throw {name: "TheoraError", message: "Invalid comment header."};
			}

			// skip headerType and "theora" string (7 bytes)
			packet.seek(7);

			// get the length of the vendor string
			len = decodeCommentLength(packet);

			/**
			 * The vendor string
			 * 
			 * @property vendor
			 */
			this.vendor = "";

			for (i = 0; i < len; i += 1) {
				this.vendor += String.fromCharCode(packet.next8());
			}

			// get the number of user comments
			ncomments = decodeCommentLength(packet);

			/**
			 * Key <-> value map of all comments
			 *
			 * @property comments
			 * @type {Object}
			 */
			this.comments = {};

			for (ci = 0; ci < ncomments; ci += 1) {

				// get raw comment
				len = decodeCommentLength(packet);
				comment = "";
				for (i = 0; i < len; i += 1) {
					comment += String.fromCharCode(packet.next8());
				}

				// split comment to key and value
				comment = comment.split('=');

				// empty fields are not disallowed, but we ignore them
				if (comment[0].length > 0) {
					// the field name is case-insensitive
					this.comments[comment[0].toLowerCase()] = comment[1];
				}
			}

		},

		// make method public
		computeQuantizationMatrix: computeQuantizationMatrix,

		/**
		 * Decodes the setup header.
		 *
		 * @method decodeSetupHeader
		 * @param {Ogg.Packet} packet
		 */
		decodeSetupHeader: function (packet) {
				// The header type
			var headerType = packet.get8(0),

				// bitstream reader
				reader;

			// check the headerType and the theora signature
			if (headerType !== 0x82 && !isTheora(packet)) {
				throw {name: "TheoraError", message: "Invalid setup header."};
			}

			// skip headerType and "theora" string (7 bytes)
			packet.seek(7);

			reader = new util.Bitstream(packet, 7);

			/**
			 * A 64-element array of loop filter limit values
			 *
			 * @property lflims
			 * @type {Array}
			 */
			this.lflims = decodeLFLTable(reader);

			decodeQuantizationParameters(reader);

			/**
			 * An 80-element array of Huffman tables with up to 32 entries each.
			 *
			 * @property hts
			 * @type {Array}
			 */
			this.hts = decodeHuffmanTables(reader);
		},

		/**
		 * Pre-computes all quantization matrices.
		 *
		 * @method computeQuantizationMatrices
		 */
		computeQuantizationMatrices: function () {
			var qti,
				pli,
				qi;

			/**
			 * All quantization matrices, which will be the same for all frames.
			 *
			 * @property qmats
			 */
			this.qmats = [];

			for (qti = 0; qti < 2; qti += 1) {
				this.qmats[qti] = [];
				for (pli = 0; pli < 3; pli += 1) {
					this.qmats[qti][pli] = [];
					for (qi = 0; qi < 64; qi += 1) {
						this.qmats[qti][pli][qi] = computeQuantizationMatrix(qti, pli, qi);
					}
				}
			}

		}

	};
}());

TheoraJS.namespace("Theora").Frame = (function () {
	"use strict";

		/* dependencies */
	var util = TheoraJS.namespace("Theora").util,
		constants = TheoraJS.namespace("Theora").constants,
		header = TheoraJS.namespace("Theora").header,

		/* private */

		// Mapping tables
		tables,

		// Offsets of the color planes
		colorPlaneOffsets,

		/* export */
		Constructor;

	/**
	 * A theora frame, which are to be decoded from an input ogg packet.
	 * If it is not an intra frame, the two reference frames have to be set.
	 *
	 * @class Frame
	 * @namespace Theora
	 * @constructor
	 * @param {Ogg.Packet} packet
	 * @param {Theora.Frame} [goldReferenceFrame]
	 * @param {Theora.Frame} [prefReferenceFrame]
	 */
	Constructor = function (packet, goldReferenceFrame, prefReferenceFrame) {
		this.packet = packet;

		// init bitwise packet reader
		this.reader = new util.Bitstream(packet, 0);

		// set reference color planes
		if (goldReferenceFrame) {
			this.goldrefy = goldReferenceFrame.recy;
			this.goldrefcb = goldReferenceFrame.reccb;
			this.goldrefcr = goldReferenceFrame.reccr;
		}
		if (prefReferenceFrame) {
			this.prevrefy = prefReferenceFrame.recy;
			this.prevrefcb = prefReferenceFrame.reccb;
			this.prevrefcr = prefReferenceFrame.reccr;
		}

		/**
		 * Direct access to a plane of the reference frame, depending on rfi and pli.
		 *
		 * @property referenceFrames
		 * @private
		 */
		this.referenceFrames = [
			// no reference frame for intra frames
			null,

			// previous reference frame
			[this.prevrefy, this.prevrefcb, this.prevrefcr],

			// golden reference frame
			[this.goldrefy, this.goldrefcb, this.goldrefcr]
		];

		/**
		 * Contains only the changed pixel coordinates form the previous frame.
		 * This can be used for faster rendering by only draw the changed pixels.
		 *
		 * @propery changedPixels
		 * @type {Array}
		 */
		this.changedPixels = [];
	};

	/**
	 * Sets the mapping tables for all frames.
	 *
	 * @method setMappingTables
	 * @static
	 * @param {Object} mTables
	 */
	Constructor.setMappingTables = function (mTables) {
		tables =  mTables;

		// offsets for all color planes
		colorPlaneOffsets = [
			0,
			header.nlbs,
			header.nlbs + header.ncbs
		];
	};

	Constructor.prototype = {
		// reset constructor reference
		constructor: TheoraJS.namespace("Theora").Frame,

		/**
		 * Decodes and reconstructs the complete frame.
		 *
		 * @method decode
		 */
		decode: function () {
				// The index of the current block
			var bi;

			// check the size of the current packet
			if (this.packet.getLength() > 0) {
				this.decodeFrameHeader();
				this.decodeCodedBlockFlags();
				this.decodeMacroBlockCodingModes();

				// decode motion vectors only for inter frames
				if (this.ftype !== 0) {
					this.decodeMacroBlockMotionVectors();
				}

				this.decodeBlockLevelQiis();
				this.decodeDCTCoefficients();
				this.invertDCPrediction();
			} else {
				// if we have an zero length packet
				// frame type will be inter frame
				// with no coded blocks,
				// so all blocks will be predicted by a reference frame
				this.ftype = 1;
				this.nqis = 1;
				this.qis[0] = 63;
				for (bi = 0; bi < header.nbs; bi += 1) {
					this.bcoded[bi] = 0;
				}
			}

			// set Y plane dimensions
			this.rpyw = 16 * header.fmbw;
			this.rpyh = 16 * header.fmbh;

			// set dimensions of the chroma planes
			// corresponding to the pixel format
			if (header.pf === 0) {
				this.rpcw = 8 * header.fmbw;
				this.rpch = 8 * header.fmbh;
			} else if (header.pf === 2) {
				this.rpcw = 8 * header.fmbw;
				this.rpch = 16 * header.fmbh;
			} else if (header.pf === 3) {
				this.rpcw = 16 * header.fmbw;
				this.rpch = 16 * header.fmbh;
			}

			// reconstruct the complte frame
			this.reconstructComplete();

			// apply the loop filter for the reconstructed frame
			this.filterLoopComplete();

		},

		/**
		 * Decodes the frame header
		 *
		 * @method decodeFrameHeader
		 * @private
		 */
		decodeFrameHeader: function () {
				// A flag indicating there are more qi values to be decoded.
			var moreQis,

				// reserved bits
				reserved;

			// first bit of a valid data packet must be set to 0
			if (this.reader.nextBits(1) !== 0) {
				throw {name: "TheoraError", message: "Unable to decode stream: invalid frame packet."};
			}

			/**
			 * The frame type.
			 *
			 * @param: ftype Value 0: intra frame, value 1: inter frame.
			 * @private
			 */
			this.ftype = this.reader.nextBits(1);

			/**
			 * The number of qi values.
			 * 
			 * @param nqis
			 * @private
			 */
			this.nqis = 1;

			/**
			 * An NQIS-element array of qi values.
			 * 
			 * @param qis
			 * @private
			 */
			this.qis = [];

			this.qis[0] = this.reader.nextBits(6);

			// check if there are more qi values available
			moreQis = this.reader.nextBits(1);
			while (moreQis === 1 && this.nqis < 3) {
				this.qis[this.nqis] = this.reader.nextBits(6);

				if (this.nqis < 2) {
					moreQis = this.reader.nextBits(1);
				}
				this.nqis += 1;
			}

			// reserved bits have to be zero on an intra frame
			if (this.ftype === 0) {
				reserved = this.reader.nextBits(3);
				if (reserved !== 0) {
					throw {name: "TheoraError", message: "Unable to decode stream: used reserved bits."};
				}
			}
		},

		/**
		 * Decodes run-length encoded bit strings.
		 *
		 * @method deocdeRunLengthBitString
		 * @private
		 * @param {Number} nbits The number of bits to decode.
		 * @param {Array} huffmanCodes Lookup table.
		 * @return {Array} The decoded bits.
		 */
		decodeRunLengthBitString: function (nbits, huffmanCodes) {
				// output
			var bits = [],

				// The number of bits decoded so far
				len = 0,

				// The value associated with the current run
				bit,

				// The length of the current run
				rlen,

				// The number of extra bits needed to decode the run length
				rbits,

				// The start of the possible run-length values for a given Huffman code
				rstart,

				// The offset from RSTART of the run-length
				roffs,

				// A Huffman code
				code,

				i;

			// return empty array if nbits is zero
			if (len === nbits) {
				return bits;
			}

			// read the current bit
			bit = this.reader.nextBits(1);

			while (true) {
				// get the huffman code
				code = this.huffmanTableLookup(huffmanCodes);

				rstart = code.rstart;
				rbits = code.rbits;

				roffs = this.reader.nextBits(rbits);
				rlen = rstart + roffs;

				// append rlen coppies of bit to bits
				for (i = 0; i < rlen; i += 1) {
					bits.push(bit);
				}

				len += rlen;

				// check if we have read enough
				if (len === nbits) {
					return bits;
				}
				if (len > nbits) {
					throw {name: "TheoraError", message: "Invalid stream."};
				}

				if (rlen === 4129) {
					bit = this.reader.nextBits(1);
				} else {
					bit = 1 - bit;
				}
			}
		},

		/**
		 * This procedure determines which blocks are coded in a given frame.
		 * In an intra frame, it marks all blocks coded. In an inter frame, however,
		 * any or all of the blocks may remain uncoded.
		 *
		 * @method decodeCodedBlockFlags
		 * @private
		 */
		decodeCodedBlockFlags: function () {
				// The length of a bit string to decode
			var nbits,

				// A decoded set of flags
				bits,

				// An array of flags indicating whether or not each super block is partially coded
				sbpCoded = [],

				// An array of flags indicating whether or not each non-partially coded super block is fully coded
				sbfCoded = [],

				// The index of the current super block
				sbi,

				// The index of the current block in coded order
				bi;

			/**
			 * An NBS-element array of flags indicating which blocks are coded.
			 *
			 * @param bcoded
			 * @private
			 * @type {Array}
			 */
			this.bcoded = [];

			/**
			 * A list only of all coded block indicies.
			 *
			 * @property codedBlocks
			 * @private
			 * @type {Array}
			 */
			this.codedBlocks = [];

			/**
			 * A list only of all uncoded block indicies.
			 *
			 * @property uncodedBlocks
			 * @private
			 * @type {Array}
			 */
			this.uncodedBlocks = [];

			// determine frame type
			if (this.ftype === 0) {
				// intra frame
				for (bi = 0; bi < header.nbs; bi += 1) {
					this.bcoded[bi] = 1;
					this.codedBlocks.push(bi);
				}
			} else {
				// inter frame

				// read for all super blocks the falgs if they are partially coded or not
				sbpCoded = this.decodeRunLengthBitString(header.nsbs, constants.LONG_RUN_LENGTH_HUFFMAN_TABLE);

				nbits = 0;
				// assign nbits the number of all non-partially coded super blocks
				for (sbi = 0; sbi < header.nsbs; sbi += 1) {
					if (sbpCoded[sbi] === 0) {
						nbits += 1;
					}
				}

				// read the flags for all non-partially coded super block if they are fully coded or not
				bits = this.decodeRunLengthBitString(nbits, constants.LONG_RUN_LENGTH_HUFFMAN_TABLE);

				// map the flags to their corresponding super blocks
				for (sbi = 0; sbi < header.nsbs; sbi += 1) {
					if (sbpCoded[sbi] === 0) {
						sbfCoded[sbi] = bits.shift();
					} else {
						sbfCoded[sbi] = 0;
					}
				}

				nbits = 0;
				// assign nbits the number of blocks contained in all partially coded super blocks
				for (sbi = 0; sbi < header.nsbs; sbi += 1) {
					if (sbpCoded[sbi] === 1) {
						nbits += tables.superBlockSizes[sbi];
					}
				}

				// read the flags that indicates that a specific block in a partially coded super block is coded or not
				bits = this.decodeRunLengthBitString(nbits, constants.SHORT_RUN_LENGTH_HUFFMAN_TABLE);

				for (bi = 0; bi < header.nbs; bi += 1) {

					sbi = tables.biToSbi[bi];

					if (sbpCoded[sbi] === 0) {
						this.bcoded[bi] = sbfCoded[sbi];
					} else {
						this.bcoded[bi] = bits.shift();
					}

					// if block is coded add it to the codedBlocks list
					if (this.bcoded[bi] !== 0) {
						this.codedBlocks.push(bi);
					} else {
						this.uncodedBlocks.push(bi);
					}
				}
			}
		},

		/**
		 * Decodes macro block conding modes
		 *
		 * @method decodeMacroBlockCodingModes
		 * @private
		 */
		decodeMacroBlockCodingModes: function () {
				// The mode coding scheme
			var mScheme,

				// The list of modes corresponding to each Huffman code
				mAlphabet = [],

				// The index of the current macro block
				mbi,

				// The index of the current block in coded order
				bi,

				// The index of a Huffman code from Table 7.19, starting from 0
				mi,

				// The current mode, which will be added to the alphabet
				mode,

				// cached length for loops
				len;

			/**
			 * An NMBS-element array of coding modes for each macro block.
			 *
			 * @param mbmodes
			 * @private
			 * @type {Array}
			 */
			this.mbmodes = [];

			// determine the frame type
			if (this.ftype === 0) {
				// on intra frames the modes will be 1 for all macro blocks
				for (mbi = 0; mbi < header.nmbs; mbi += 1) {
					this.mbmodes[mbi] = 1;
				}
			} else {
				// get the used coding scheme of the frame
				mScheme = this.reader.nextBits(3);

				if (mScheme === 0) {
					// for mScheme 0 read the alphabet from the input packt
					for (mode = 0; mode < 8; mode += 1) {
						mi = this.reader.nextBits(3);
						mAlphabet[mi] = mode;
					}
				} else if (mScheme !== 7) {
					// get the alphabet from a predefined table
					mAlphabet = constants.MACRO_BLOCK_MODE_SCHEMES[mScheme];
				}

				for (mbi = 0; mbi < header.nmbs; mbi += 1) {

					// check if there is at least one coded block in the current macro block
					len = mbi * 4 + 4;
					for (bi = mbi * 4; bi < len; bi += 1) {
						if (this.bcoded[bi] === 1) {
							if (mScheme !== 7) {
								mi = this.huffmanTableLookup(constants.MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE);
								this.mbmodes[mbi] = mAlphabet[mi];
							} else {
								this.mbmodes[mbi] = this.reader.nextBits(3);
							}
							break;
						}
					}

					// default value: 0 (INTER_NOMV)
					this.mbmodes[mbi] = this.mbmodes[mbi] || 0;
				}
			}
		},

		/**
		 * Reads a bit at a time until a huffman code is found in a given map.
		 *
		 * @method huffmanTableLookup
		 * @private
		 * @param {Array} map The keys of the map must be huffman codes (bitstrings)
		 * @return {Object} The corresponding object from the map
		 */
		huffmanTableLookup: function (map) {
			var code = 0,
				bits = -1,
				key;

			do {
				bits += 1;
				code += this.reader.nextBits(1);
				key = code - map[1][bits];
				code <<= 1;
			} while (map[0][bits][key] === undefined);

			return map[0][bits][key];
		},

		/**
		 * Reads a bit at a time until a huffman code is found in a given map.
		 *
		 * @method huffmanTableLookup
		 * @private
		 * @param {Object} map The keys of the map must be huffman codes (bitstrings)
		 * @return {Object} The corresponding object from the map
		 */
		dynamicHuffmanTableLookup: function (map) {
			var code = 0,
				key,
				bits = -1;

			do {
				code += this.reader.nextBits(1);
				bits += 1;
				key = code;
				code <<= 1;
			} while (!map[bits].hasOwnProperty(key));

			return map[bits][key];
		},

		/**
		 * Decodes a single motion vector.
		 *
		 * @method decodeMotionVector
		 * @private
		 * @param {Number} mvmode The motion vector decoding mode.
		 * @return {Array} [mvx, mvy]
		 */
		decodeMotionVector: function (mvmode) {
				// The sign of the motion vector component just decoded
			var mvSign,

				// return values
				mvx,
				mvy;

			if (mvmode === 0) {
				mvx = this.huffmanTableLookup(constants.MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE);
				mvy = this.huffmanTableLookup(constants.MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE);
			} else {
				// read mvx
				mvx = this.reader.nextBits(5);
				// check sign
				mvSign = this.reader.nextBits(1);
				if (mvSign === 1) {
					mvx = -mvx;
				}

				// read mvy
				mvy = this.reader.nextBits(5);
				// check sign
				mvSign = this.reader.nextBits(1);
				if (mvSign === 1) {
					mvy = -mvy;
				}
			}

			return [mvx, mvy];
		},

		/**
		 * Decodes the motion vectors for all macro blocks.
		 * Motion vectors are stored for each macro block and will be asigned to all of their blocks
		 * in all color planes.
		 * Except INTER_MV_FOUR, in this case every block of the luma plane will have its one motion vector.
		 *
		 * @method decodeMacroBlockMotionVectors
		 * @private
		 */
		decodeMacroBlockMotionVectors: function () {
				// last motion vector
			var last1 = [0, 0],

				// second last motion vector
				last2 = [0, 0],

				// The X component of a motion vector
				mvx,

				// The Y component of a motion vector
				mvy,

				// The index of the current macro block
				mbi,

				// The index of the lower-left luma block in the macro block
				a,

				// The index of the lower-right luma block in the macro block
				b,

				// The index of the upper-left luma block in the macro block
				c,

				// The index of the upper-right luma block in the macro block
				d,

				// indices of the chroma blocks in the macro block, corresponding to the pixel format
				e,
				f,
				g,
				h,
				i,
				j,
				k,
				l,

				// all blocks contained by the current macro block
				blocksOfMacroBlock,

				// the current block index in coded order
				bi,

				// the motion vector coding mode
				mvmode,

				// a single motion vector
				mVector,

				// loop counter
				cnt;



			/**
			 * An NBS-element array of motion vectors for each block.
			 *
			 * @param mvects
			 */
			this.mvects = [];

			mvmode = this.reader.nextBits(1);

			for (mbi = 0; mbi < header.nmbs; mbi += 1) {
				if (this.mbmodes[mbi] === 7) {
					blocksOfMacroBlock = tables.mbiToBi[mbi];

					a = blocksOfMacroBlock[0];
					b = blocksOfMacroBlock[1];
					c = blocksOfMacroBlock[2];
					d = blocksOfMacroBlock[3];

					if (this.bcoded[a] !== 0) {
						mVector = this.decodeMotionVector(mvmode);
						mvx = mVector[0];
						mvy = mVector[1];
						this.mvects[a] = mVector;
					} else {
						this.mvects[a] = [0, 0];
					}

					if (this.bcoded[b] !== 0) {
						mVector = this.decodeMotionVector(mvmode);
						mvx = mVector[0];
						mvy = mVector[1];
						this.mvects[b] = mVector;
					} else {
						this.mvects[b] = [0, 0];
					}

					if (this.bcoded[c] !== 0) {
						mVector = this.decodeMotionVector(mvmode);
						mvx = mVector[0];
						mvy = mVector[1];
						this.mvects[c] = mVector;
					} else {
						this.mvects[c] = [0, 0];
					}

					if (this.bcoded[d] !== 0) {
						mVector = this.decodeMotionVector(mvmode);
						mvx = mVector[0];
						mvy = mVector[1];
						this.mvects[d] = mVector;
					} else {
						this.mvects[d] = [0, 0];
					}

					switch (header.pf) {
					case 0:	// (4:2:0) subsampling
						e = blocksOfMacroBlock[4];
						f = blocksOfMacroBlock[5];

						mVector = [];
						// x component
						mVector[0] = Math.round((this.mvects[a][0] + this.mvects[b][0] + this.mvects[c][0] + this.mvects[d][0]) / 4);
						// y component
						mVector[1] = Math.round((this.mvects[a][1] + this.mvects[b][1] + this.mvects[c][1] + this.mvects[d][1]) / 4);

						this.mvects[e] = mVector;
						this.mvects[f] = mVector;
						break;
					case 2: // (4:2:2) subsampling
						e = blocksOfMacroBlock[4];
						f = blocksOfMacroBlock[5];
						g = blocksOfMacroBlock[6];
						h = blocksOfMacroBlock[7];

						mVector = [];
						// x component
						mVector[0] = Math.round((this.mvects[a][0] + this.mvects[b][0]) / 2);
						// y component
						mVector[1] = Math.round((this.mvects[a][1] + this.mvects[b][1]) / 2);

						this.mvects[e] = mVector;
						this.mvects[g] = mVector;

						mVector = [];
						// x component
						mVector[0] = Math.round((this.mvects[c][0] + this.mvects[d][0]) / 2);
						// y component
						mVector[1] = Math.round((this.mvects[c][1] + this.mvects[d][1]) / 2);

						this.mvects[f] = mVector;
						this.mvects[h] = mVector;
						break;
					default: // 4:4:4
						// lower-left of cb plane
						e = blocksOfMacroBlock[4];
						// lower-right of cb plane
						f = blocksOfMacroBlock[5];
						// upper-left of cb plane
						g = blocksOfMacroBlock[6];
						// upper-right of cb plane
						h = blocksOfMacroBlock[7];

						// lower-left of cr plane
						i = blocksOfMacroBlock[8];
						// lower-right of cr plane
						j = blocksOfMacroBlock[9];
						// upper-left of cr plane
						k = blocksOfMacroBlock[10];
						// upper-right of cr plane
						l = blocksOfMacroBlock[11];

						this.mvects[e] = this.mvects[a];
						this.mvects[i] = this.mvects[a];

						this.mvects[f] = this.mvects[b];
						this.mvects[j] = this.mvects[b];

						this.mvects[g] = this.mvects[c];
						this.mvects[k] = this.mvects[c];

						this.mvects[h] = this.mvects[d];
						this.mvects[l] = this.mvects[d];
						break;
					}

					last2 = last1;
					last1 = [mvx, mvy];
				} else if (this.mbmodes[mbi] === 6) {
					// INTER_GOLDEN_MV

					mVector = this.decodeMotionVector(mvmode);
					mvx = mVector[0];
					mvy = mVector[1];
				} else if (this.mbmodes[mbi] === 4) {
					// INTER_MV_LAST2

					mvx = last2[0];
					mvy = last2[1];

					last2 = last1;
					last1 = [mvx, mvy];
				} else if (this.mbmodes[mbi] === 3) {
					// INTER_MV_LAST1

					mvx = last1[0];
					mvy = last1[1];
				} else if (this.mbmodes[mbi] === 2) {
					// INTER_MV

					mVector = this.decodeMotionVector(mvmode);
					mvx = mVector[0];
					mvy = mVector[1];
					last2 = last1;
					last1 = [mvx, mvy];
				} else {
					// INTER_GOLDEN_NOMV, INTRA or INTER_NOMV

					mvx = 0;
					mvy = 0;
				}

				if (this.mbmodes[mbi] !== 7) {
					// not INTER_MV_FOUR

					// for all bi’s in macro block mbi
					for (cnt = 0; cnt < tables.mbiToBi[mbi].length; cnt += 1) {
						bi = tables.mbiToBi[mbi][cnt];
						this.mvects[bi] = [mvx, mvy];
					}

				}
			}

		},

		/**
		 * This procedure selects the qi value to be used for dequantizing the
		 * AC coefficients of each block.
		 *
		 * @method decodeBlockLevelQiis
		 * @private
		 */
		decodeBlockLevelQiis: function () {
				// length of a bit string to decode
			var nbits,

				// decoded set of flags
				bits,

				// index of the current block in coded order
				bi,

				// index of qi value in the list of qi values defined for this frame
				qii;

			/**
			 * An NBS-element array of qii values for each block
			 *
			 * @param qiis
			 * @type {Array}
			 */
			this.qiis = [];

			// initialize all qi values with 0
			for (bi = 0; bi < header.nbs; bi += 1) {
				this.qiis[bi] = 0;
			}

			for (qii = 0; qii < (this.nqis - 1); qii += 1) {

				// assign nbits the number of coded blocks where qiis[bi] == qii
				nbits = 0;
				for (bi = 0; bi < header.nbs; bi += 1) {
					if (this.bcoded[bi] !== 0 && this.qiis[bi] === qii) {
						nbits += 1;
					}
				}

				// read an nbits string
				bits = this.decodeRunLengthBitString(nbits, constants.LONG_RUN_LENGTH_HUFFMAN_TABLE);

				// add the recently read data to their corresponding qi value
				for (bi = 0; bi < header.nbs; bi += 1) {
					if (this.bcoded[bi] !== 0 && this.qiis[bi] === qii) {
						this.qiis[bi] += bits.shift();
					}
				}
			}
		},

		/**
		 * Decodes an EOB token.
		 *
		 * @method decodeEOBToken
		 * @private
		 * @param {Number} token The token being decoded (Allowed range: 0..6).
		 * @param {Array} tis Array of the current token index.
		 * @param {Number} bi The block index in coded order.
		 * @param {Number} ti The current token index.
		 * @return {Number} The remaining length of the current EOB run.
		 */
		decodeEOBToken: function (token, tis, bi, ti) {
				// output
			var eobs,

				// Another index of a block in coded order
				bj,

				// Another token index
				tj,

				i;

			switch (token) {
			case 0:
				eobs = 1;
				break;
			case 1:
				eobs = 2;
				break;
			case 2:
				eobs = 3;
				break;
			case 3:
				eobs = this.reader.nextBits(2) + 4;
				break;
			case 4:
				eobs = this.reader.nextBits(3) + 8;
				break;
			case 5:
				eobs = this.reader.nextBits(4) + 16;
				break;
			default: // token will be 6
				eobs = this.reader.nextBits(12);

				if (eobs === 0) {
					// assign EOBS to be the number of coded blocks bj
					// such that TIS[bj ] is less than 64
					bj = 0;
					for (i = 0; i < this.codedBlocks.length; i += 1) {
						if (tis[bj] < 64) {
							break;
						}
						bj += 1;
					}
					eobs = bj;
				}

				break;
			}

			for (tj = ti; tj < 64; tj += 1) {
				this.coeffs[bi][tj] = 0;
			}

			this.ncoeffs[bi] = tis[bi];
			tis[bi] = 64;
			eobs -= 1;

			return eobs;
		},

		/**
		 * Decodes one or more coefficients in the current block for a specific token.
		 *
		 * @method decodeCoefficientToken
		 * @private
		 * @param {Number} token The token being decoded (Allowed range: 0..6).
		 * @param {Array} tis Array of the current token index.
		 * @param {Number} bi The block index in coded order.
		 * @param {Number} ti The current token index.
		 */
		decodeCoefficientToken: function (token, tis, bi, ti) {
				// A flag indicating the sign of the current coefficient
			var sign,

				// The magnitude of the current coefficient
				mag,

				// The length of the current zero run
				rlen,

				// Another token index
				tj;

			switch (token) {
			case 7:
				rlen = this.reader.nextBits(3);
				rlen += 1;
				for (tj = ti; tj < (ti + rlen); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				tis[bi] += rlen;
				break;
			case 8:
				rlen = this.reader.nextBits(6);
				rlen += 1;
				for (tj = ti; tj < (ti + rlen); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				tis[bi] += rlen;
				break;
			case 9:
				this.coeffs[bi][ti] = 1;
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 10:
				this.coeffs[bi][ti] = -1;
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 11:
				this.coeffs[bi][ti] = 2;
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 12:
				this.coeffs[bi][ti] = -2;
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 13:
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti] = 3;
				} else {
					this.coeffs[bi][ti] = -3;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 14:
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti] = 4;
				} else {
					this.coeffs[bi][ti] = -4;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 15:
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti] = 5;
				} else {
					this.coeffs[bi][ti] = -5;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 16:
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti] = 6;
				} else {
					this.coeffs[bi][ti] = -6;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 17:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(1);
				mag += 7;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 18:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(2);
				mag += 9;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 19:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(3);
				mag += 13;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 20:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(4);
				mag += 21;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 21:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(5);
				mag += 37;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 22:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(9);
				mag += 69;
				if (sign === 0) {
					this.coeffs[bi][ti] = mag;
				} else {
					this.coeffs[bi][ti] = -mag;
				}
				tis[bi] += 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 23:
				this.coeffs[bi][ti] = 0;
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti + 1] = 1;
				} else {
					this.coeffs[bi][ti + 1] = -1;
				}
				tis[bi] += 2;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 24:
				for (tj = ti; tj < (ti + 2); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti + 2] = 1;
				} else {
					this.coeffs[bi][ti + 2] = -1;
				}
				tis[bi] += 3;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 25:
				for (tj = ti; tj < (ti + 3); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti + 3] = 1;
				} else {
					this.coeffs[bi][ti + 3] = -1;
				}
				tis[bi] += 4;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 26:
				for (tj = ti; tj < (ti + 4); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti + 4] = 1;
				} else {
					this.coeffs[bi][ti + 4] = -1;
				}
				tis[bi] += 5;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 27:
				for (tj = ti; tj < (ti + 5); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				sign = this.reader.nextBits(1);
				if (sign === 0) {
					this.coeffs[bi][ti + 5] = 1;
				} else {
					this.coeffs[bi][ti + 5] = -1;
				}
				tis[bi] += 6;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 28:
				sign = this.reader.nextBits(1);
				rlen = this.reader.nextBits(2);
				rlen += 6;
				for (tj = ti; tj < (ti + rlen); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				if (sign === 0) {
					this.coeffs[bi][ti + rlen] = 1;
				} else {
					this.coeffs[bi][ti + rlen] = -1;
				}
				tis[bi] += rlen + 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 29:
				sign = this.reader.nextBits(1);
				rlen = this.reader.nextBits(3);
				rlen += 10;
				for (tj = ti; tj < (ti + rlen); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				if (sign === 0) {
					this.coeffs[bi][ti + rlen] = 1;
				} else {
					this.coeffs[bi][ti + rlen] = -1;
				}
				tis[bi] += rlen + 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 30:
				this.coeffs[bi][ti] = 0;
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(1);
				mag += 2;
				if (sign === 0) {
					this.coeffs[bi][ti + 1] = mag;
				} else {
					this.coeffs[bi][ti + 1] = -mag;
				}
				tis[bi] += 2;
				this.ncoeffs[bi] = tis[bi];
				break;
			case 31:
				sign = this.reader.nextBits(1);
				mag = this.reader.nextBits(1);
				mag += 2;
				rlen = this.reader.nextBits(1);
				rlen += 2;
				for (tj = ti; tj < (ti + rlen); tj += 1) {
					this.coeffs[bi][tj] = 0;
				}
				if (sign === 0) {
					this.coeffs[bi][ti + rlen] = mag;
				} else {
					this.coeffs[bi][ti + rlen] = -mag;
				}
				tis[bi] += rlen + 1;
				this.ncoeffs[bi] = tis[bi];
				break;
			default:
				throw {name: "TheoraError", message: "Unable to decode stream: invalid frame packet."};
			}
		},

		/**
		 * Decodes all DCT coefficients.
		 *
		 * @method decodeDCTCoefficients
		 * @private
		 */
		decodeDCTCoefficients: function () {
				// Index of the current block in coded order
			var bi,

				// Current token index
				ti,

				// Another token index
				tj,

				// Index of the current Huffman table to use for the luma plane within a group
				htiL,

				// Index of the current Huffman table to use for the chroma planes within a group
				htiC,

				// Index of the current Huffman table to use
				hti,

				// An NBS-element array of the current token index for each block
				tis = [],

				// The remaining length of the current EOB run
				eobs,

				// The current token being decoded
				token,

				// The current Huffman table group
				hg,

				// Copy of the coded blocks list
				list = this.codedBlocks.slice(),

				// length of the list
				len = list.length,

				i;

			/**
			 * An NBS × 64 array of quantized DCT coefficient values for each block in zig-zag order
			 *
			 * @proerty coeffs
			 * @type {Array}
			 */
			this.coeffs = [];

			/**
			 * An NBS-element array of the coefficient count for each block
			 *
			 * @proerty coeffs
			 * @type {Array}
			 */
			this.ncoeffs = [];

			// init
			for (bi = 0; bi < header.nbs; bi += 1) {
				tis[bi] = 0;
				this.ncoeffs[bi] = 0;
				this.coeffs[bi] = [];
				for (i = 0; i < 64; i += 1) {
					this.coeffs[bi][i] = 0;
				}
			}

			eobs = 0;

			for (ti = 0; ti < 64; ti += 1) {
				if (ti === 0 || ti === 1) {
					htiL = this.reader.nextBits(4);
					htiC = this.reader.nextBits(4);
				}

				// for all coded blocks in the current list
				for (i = 0; i < len; i += 1) {
					bi = list[i];

					if (tis[bi] === ti) {

						this.ncoeffs[bi] = ti;
						if (eobs > 0) {
							for (tj = ti; tj < 64; tj += 1) {
								this.coeffs[bi][tj] = 0;
							}
							tis[bi] = 64;
							eobs -= 1;
						} else {
							hg = constants.HUFFMAN_TABLE_GROUPS[ti];
							if (bi < header.nlbs) {
								hti = 16 * hg + htiL;
							} else {
								hti = 16 * hg + htiC;
							}
							token = this.dynamicHuffmanTableLookup(header.hts[hti]);
							if (token < 7) {
								eobs = this.decodeEOBToken(token, tis, bi, ti);
							} else {
								this.decodeCoefficientToken(token, tis, bi, ti);
							}
						}

						if (tis[bi] === 64) {
							// we have all coefficients for the current block
							// so we can remove bi from the list
							list.splice(i, 1);
							i -= 1;
							len -= 1;
						}
					}
				}
			}
		},

		/**
		 * This procedure outlines how a predictor is formed for a single block.
		 * The predictor is computed as a weighted sum of the neighboring DC values
		 * from coded blocks which use the same reference frame.
		 *
		 * @method computeDCPredictor
		 * @private
		 * @param {Number} bi Block index in coded order
		 * @param {Array} lastdc A 3-element array containing the most recently decoded DC value
		 * @return	{Number} The predicted DC value for the current block
		 */
		computeDCPredictor: function (bi, lastdc) {
				// output
			var dcpred,

				// A 4-element array indicating which neighbors can be used for DC prediction
				p = [],

				// A 4-element array containing the coded-order block index of the current block’s neighbors
				pbi = [],

				// The weights to apply to each neighboring DC value
				w,

				// The value to divide the weighted sum by
				pdiv,

				// The index of a neighboring block in coded order
				bj,

				// The index of the macro block containing block bi
				mbi,

				// The index of the macro block containing block bj
				mbj,

				// The index of the reference frame
				rfi,

				// The index of the current color plan
				pli = 0,

				// The index of the current block in raster order
				bri,

				// The width of the current color plane
				planeWidth = header.flbw;

			// get the corresponding macro block index and reference frame index
			mbi = tables.biToMbi[bi];
			rfi = constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbi]];

			// determine the color plane index
			if (bi >= header.nlbs + header.ncbs) {
				pli = 2;
				planeWidth = header.fcbw;
			} else if (bi >= header.nlbs) {
				pli = 1;
				planeWidth = header.fcbw;
			}

			// bri relative to the color plane
			bri = tables.codedToRasterOrder[bi] - colorPlaneOffsets[pli];

			p[0] = 0;
			// if bi is not along the left edge of the coded frame
			if (bri % planeWidth !== 0) {
				// left neighbor of bi in coded order
				bj = tables.rasterToCodedOrder[bri - 1 + colorPlaneOffsets[pli]];

				if (this.bcoded[bj] !== 0) {
					mbj = tables.biToMbi[bj];
					if (rfi === constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbj]]) {
						p[0] = 1;
						pbi[0] = bj;
					}
				}
			}

			p[1] = 0;
			//  block bi is not along the left edge nor the bottom edge of the coded frame
			if (bri % planeWidth !== 0 && bri >= planeWidth) {
				// lower-left neighbor of bi in coded order
				bj = tables.rasterToCodedOrder[bri - 1 - planeWidth + colorPlaneOffsets[pli]];

				if (this.bcoded[bj] !== 0) {
					mbj = tables.biToMbi[bj];
					if (rfi === constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbj]]) {
						p[1] = 1;
						pbi[1] = bj;
					}
				}
			}

			p[2] = 0;
			// block bi is not along the the bottom edge of the coded frame
			if (bri >= planeWidth) {
				// lower neighbor of bi in coded order
				bj = tables.rasterToCodedOrder[bri - planeWidth + colorPlaneOffsets[pli]];

				if (this.bcoded[bj] !== 0) {
					mbj = tables.biToMbi[bj];
					if (rfi === constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbj]]) {
						p[2] = 1;
						pbi[2] = bj;
					}
				}
			}

			p[3] = 0;
			// block bi is not along the right edge nor the bottom edge of the coded frame
			if ((bri + 1) % planeWidth !== 0 && bri >= planeWidth) {
				// lower-right neighbor of bi in coded order
				bj = tables.rasterToCodedOrder[bri + 1 - planeWidth + colorPlaneOffsets[pli]];

				if (this.bcoded[bj] !== 0) {
					mbj = tables.biToMbi[bj];
					if (rfi === constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbj]]) {
						p[3] = 1;
						pbi[3] = bj;
					}
				}
			}

			// If none of the values P[0], P[1], P[2], nor P[3] are non-zero
			if (p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 0) {
				dcpred = lastdc[rfi];
			} else {
				w = constants.DCPREDICTORS_WEIGHTS_AND_DIVISORS_TABLE[p.join("")].weights;
				pdiv = constants.DCPREDICTORS_WEIGHTS_AND_DIVISORS_TABLE[p.join("")].divisor;
				dcpred = 0;
				if (p[0] !== 0) {
					dcpred += w[0] * this.coeffs[pbi[0]][0];
				}
				if (p[1] !== 0) {
					dcpred += w[1] * this.coeffs[pbi[1]][0];
				}
				if (p[2] !== 0) {
					dcpred += w[2] * this.coeffs[pbi[2]][0];
				}
				if (p[3] !== 0) {
					dcpred += w[3] * this.coeffs[pbi[3]][0];
				}
				dcpred = util.toInt(dcpred / pdiv);

				// If P[0], P[1], and P[2] are all non-zero
				if (p[0] !== 0 && p[1] !== 0 && p[2] !== 0) {
					if (Math.abs(dcpred - this.coeffs[pbi[2]][0]) > 128) {
						dcpred = this.coeffs[pbi[2]][0];
					} else if (Math.abs(dcpred - this.coeffs[pbi[0]][0]) > 128) {
						dcpred = this.coeffs[pbi[0]][0];
					} else if (Math.abs(dcpred - this.coeffs[pbi[1]][0]) > 128) {
						dcpred = this.coeffs[pbi[1]][0];
					}
				}
			}

			return dcpred;
		},

		/**
		 * This procedure inverts the DC prediction to recover the original DC values.
		 *
		 * @method invertDCPrediction
		 * @private
		 */
		invertDCPrediction: function () {
				// The predicted DC value for the current block
			var dcpred,

				// The most recently decoded DC values
				lastdc = [],

				// The actual DC value for the current block
				dc,

				// The index of the current block in coded order
				bi,

				// The index of the current block in raster order
				bri,

				// Cached length for a loop
				len,

				// The index of the macro block containing block bi 
				mbi,

				// The index of the reference frame
				rfi,

				// The index of the current color plane
				pli;

			for (pli = 0; pli < 3; pli += 1) {
				lastdc[0] = 0;
				lastdc[1] = 0;
				lastdc[2] = 0;

				if (pli === 0) {
					len = header.nlbs;
				} else {
					len = header.ncbs;
				}

				for (bri = 0; bri < len; bri += 1) {
					bi = tables.rasterToCodedOrder[bri + colorPlaneOffsets[pli]];
					if (this.bcoded[bi] !== 0) {
						dcpred = this.computeDCPredictor(bi, lastdc);
						dc = this.coeffs[bi][0] + dcpred;
						// truncate dc to a signed 16-bit representation
						if (dc >= 32768) {
							dc = 32768;
						} else if (dc <= -32768) {
							dc = -32768;
						}

						this.coeffs[bi][0] = dc;
						mbi = tables.biToMbi[bi];
						rfi = constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbi]];
						lastdc[rfi] = dc;
					}
				}
			}
		},

		/**
		 * The whole pixel predictor simply copies verbatim the contents of the
		 * reference frame pointed to by the block’s motion vector.
		 *
		 * @method getWholePixelPredictor
		 * @private
		 * @param {Number} rpw Width of the current reference plane
		 * @param {Number} rph Height of the current reference plane
		 * @param {Array} refp Content of the current reference plane
		 * @param {Number} bx The horizontal pixel index of the lower-left corner of the current block
		 * @param {Number} by The vertical pixel index of the lower-left corner of the current block
		 * @param {Number} mvx The horizontal component of the block motion vector
		 * @param {Number} mvy The vertical component of the block motion vector
		 * @return {Array} Predictor values to use for INTER coded blocks
		 */
		getWholePixelPredictor: function (rpw, rph, refp, bx, by, mvx, mvy) {
				// output
			var pred = [],

				// The horizontal pixel index in the block
				bix,

				// The vertical pixel index in the block
				biy,

				// The horizontal pixel index in the reference frame
				rx,

				// The vertical pixel index in the reference frame
				ry,

				// The vertical component of the moved pixel
				my = by + mvy,

				// The horizontal component of the moved pixel
				mx = bx + mvx;

			for (biy = 0; biy < 8; biy += 1) {
				ry = my + biy;
				// clamp
				if (ry > (rph - 1)) {
					ry = (rph - 1);
				} else if (ry < 0) {
					ry = 0;
				}

				pred[biy] = [];

				rx = mx;
				if (rx < 0) {
					for (bix = 0; bix < 8; bix += 1) {
						if (rx < 0) {
							pred[biy][bix] = refp[ry][0];
						} else {
							pred[biy][bix] = refp[ry][rx];
						}
						rx += 1;
					}
				} else if ((rx + 7) > (rpw - 1)) {
					for (bix = 0; bix < 8; bix += 1) {
						if (rx > (rpw - 1)) {
							pred[biy][bix] = refp[ry][rpw - 1];
						} else {
							pred[biy][bix] = refp[ry][rx];
						}
						rx += 1;
					}
				} else {
					pred[biy][0] = refp[ry][rx];
					pred[biy][1] = refp[ry][rx + 1];
					pred[biy][2] = refp[ry][rx + 2];
					pred[biy][3] = refp[ry][rx + 3];
					pred[biy][4] = refp[ry][rx + 4];
					pred[biy][5] = refp[ry][rx + 5];
					pred[biy][6] = refp[ry][rx + 6];
					pred[biy][7] = refp[ry][rx + 7];
				}
			}

			return pred;
		},

		/**
		 * The half-pixel predictor converts the fractional motion vector into two whole-pixel motion vectors
		 *
		 * @method getHalfPixelPredictor
		 * @private
		 * @param {Number} rpw Width of the current reference plane
		 * @param {Number} rph Height of the current reference plane
		 * @param {Array} refp Content of the current reference plane
		 * @param {Number} bx The horizontal pixel index of the lower-left corner of the current block
		 * @param {Number} by The vertical pixel index of the lower-left corner of the current block
		 * @param {Number} mvx The horizontal component of the first whole-pixel motion vector
		 * @param {Number} mvy The vertical component of the first whole-pixel motion vector
		 * @param {Number} mvx2 The horizontal component of the second whole-pixel motion vector
		 * @param {Number} mvy2 The vertical component of the second whole-pixel motion vector
		 * @return {Array} Predictor values to use for INTER coded blocks
		 */
		getHalfPixelPredictor: function (rpw, rph, refp, bx, by, mvx, mvy, mvx2, mvy2) {
				// output
			var pred = [],

				// The horizontal pixel index in the block
				bix,

				// The vertical pixel index in the block
				biy,

				// The first horizontal pixel index in the reference frame
				rx1,

				// The first vertical pixel index in the reference frame
				ry1,

				// The second horizontal pixel index in the reference frame
				rx2,

				// The second vertical pixel index in the reference frame
				ry2,

				// The vertical component of first the moved pixel
				my1 = by + mvy,

				// The horizontal component of the first moved pixel
				mx1 = bx + mvx,

				// The vertical component of the second moved pixel
				my2 = by + mvy2,

				// The horizontal component of second the moved pixel
				mx2 = bx + mvx2;

			for (biy = 0; biy < 8; biy += 1) {
				ry1 = my1 + biy;
				// clamp
				if (ry1 > (rph - 1)) {
					ry1 = (rph - 1);
				} else if (ry1 < 0) {
					ry1 = 0;
				}

				ry2 = my2 + biy;
				// clamp
				if (ry2 > (rph - 1)) {
					ry2 = (rph - 1);
				} else if (ry2 < 0) {
					ry2 = 0;
				}

				pred[biy] = [];
				for (bix = 0; bix < 8; bix += 1) {
					rx1 = mx1 + bix;
					// clamp
					if (rx1 > (rpw - 1)) {
						rx1 = (rpw - 1);
					} else if (rx1 < 0) {
						rx1 = 0;
					}

					rx2 = mx2 + bix;
					// clamp
					if (rx2 > (rpw - 1)) {
						rx2 = (rpw - 1);
					} else if (rx2 < 0) {
						rx2 = 0;
					}

					pred[biy][bix] = (refp[ry1][rx1] + refp[ry2][rx2]) >> 1;
				}
			}

			return pred;
		},

		/**
		 * This procedure takes the quantized DCT coefficient values in zig-zag order
		 * for a single block—after DC prediction has been undone—and returns the dequantized
		 * values in natural order.
		 *
		 * @method dequantize
		 * @private
		 * @param {Number} qti A quantization type index
		 * @param {Number} pli A color plane index
		 * @param {Number} qi0 The quantization index of the DC coefficient
		 * @param {Number} qi The quantization index of the AC coefficients
		 * @param {Number} bi The index of the current block in coded order
		 * @return {Array} Dequantized DCT coefficients
		 */
		dequantize: function (qti, pli, qi0, qi, bi) {
				// output
			var dqc = [],

				// A quantization matrix
				qmat,

				// The DCT coefficient index in natural order
				ci,

				// The DCT coefficient index in zig-zag order
				zzi,

				// A single dequantized coefficient
				c,

				// Row of the zig-zag order mapping table
				row,

				// Column of the zig-zag order mapping table
				col;

			// compute the DC quantization matrix QMAT
			qmat = header.qmats[qti][pli][qi0];
			c = this.coeffs[bi][0] * qmat[0];

			// truncate c to a signed 16-bit representation
			if (c >= 32768) {
				c = 32768;
			} else if (c <= -32768) {
				c = -32768;
			}

			dqc[0] = c;

			// compute the AC quantization matrix QMAT
			qmat = header.qmats[qti][pli][qi];
			ci = 1;
			col = 1;
			for (row = 0; row < 8; row += 1) {
				while (col < 8) {
					zzi = constants.ZIG_ZAG_ORDER_MAPPING_TABLE[row][col];
					c = this.coeffs[bi][zzi] * qmat[ci];

					// truncate c to a signed 16-bit representation
					if (c >= 32768) {
						c = 32768;
					} else if (c <= -32768) {
						c = -32768;
					}

					dqc[ci] = c;
					ci += 1;
					col += 1;
				}
				col = 0;
			}

			return dqc;
		},

		/**
		 * Seperated 1D inverse DCT.
		 *
		 * @method invertDCT1D
		 * @private
		 * @param {Array} y An 8-element array of DCT coefficients
		 * @return {Array}
		 */
		invertDCT1D: function (y) {
				// An 8-element array of output values
			var x = [],

				// An 8-element array containing the current value of each signal line
				t = [],

				// A temporary value
				r,

				// 16-bit Approximations of Sines and Cosines
				c3 = constants.COSINES[2],
				c4 = constants.COSINES[3],
				c6 = constants.COSINES[5],
				c7 = constants.COSINES[6],
				s3 = constants.SINES[2],
				s6 = constants.SINES[5],
				s7 = constants.SINES[6];

			// the implementation of the inverse DCT has to be exactly as described in the theora specification
			// 7.9.3.1 The 1D Inverse DCT

			t[0] = y[0] + y[4];
			// truncate t[0] to a signed 16-bit representation
			if (t[0] >= 32768) {
				t[0] = 32768;
			} else if (t[0] <= -32768) {
				t[0] = -32768;
			}
			t[0] = c4 * t[0] >> 16;

			t[1] = y[0] - y[4];
			// truncate t[1] to a signed 16-bit representation
			if (t[1] >= 32768) {
				t[1] = 32768;
			} else if (t[1] <= -32768) {
				t[1] = -32768;
			}
			t[1] = c4 * t[1] >> 16;

			t[2] = (c6 * y[2] >> 16) - (s6 * y[6] >> 16);

			t[3] = (s6 * y[2] >> 16) + (c6 * y[6] >> 16);

			t[4] = (c7 * y[1] >> 16) - (s7 * y[7] >> 16);

			t[5] = (c3 * y[5] >> 16) - (s3 * y[3] >> 16);

			t[6] = (s3 * y[5] >> 16) + (c3 * y[3] >> 16);

			t[7] = (s7 * y[1] >> 16) + (c7 * y[7] >> 16);

			r = t[4] + t[5];
			t[5] = t[4] - t[5];
			// truncate t[5] to a signed 16-bit representation
			if (t[5] >= 32768) {
				t[5] = 32768;
			} else if (t[5] <= -32768) {
				t[5] = -32768;
			}
			t[5] = c4 * t[5] >> 16;
			t[4] = r;

			r = t[7] + t[6];
			t[6] = t[7] - t[6];
			// truncate t[6] to a signed 16-bit representation
			if (t[6] >= 32768) {
				t[6] = 32768;
			} else if (t[6] <= -32768) {
				t[6] = -32768;
			}
			t[6] = c4 * t[6] >> 16;
			t[7] = r;

			r = t[0] + t[3];
			t[3] = t[0] - t[3];
			t[0] = r;

			r = t[1] + t[2];
			t[2] = t[1] - t[2];
			t[1] = r;

			r = t[6] + t[5];
			t[5] = t[6] - t[5];
			t[6] = r;

			r = t[0] + t[7];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[0] = r;

			r = t[1] + t[6];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[1] = r;

			r = t[2] + t[5];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[2] = r;

			r = t[3] + t[4];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[3] = r;

			r = t[3] - t[4];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[4] = r;

			r = t[2] - t[5];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[5] = r;

			r = t[1] - t[6];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[6] = r;

			r = t[0] - t[7];
			// truncate r to a signed 16-bit representation
			if (r >= 32768) {
				r = 32768;
			} else if (r <= -32768) {
				r = -32768;
			}
			x[7] = r;

			return x;
		},

		/**
		 * The 2D inverse DCT procedure applies 16 times the 1D inverse DCT procedure.
		 * Once for each row and each column of a block.
		 *
		 * @method invertDCT2D
		 * @private
		 * @param {Array} dqc Dequantized DCT coefficients in natural order 
		 * @return {Array} An 8 × 8 array containing the decoded residual
		 */
		invertDCT2D: function (dqc) {
				// output: residual
			var res = [],

				// The column index
				ci,

				// The row index
				ri,

				// An 8-element array of 1D iDCT input values.
				y = [],

				// An 8-element array of 1D iDCT output values.
				x;

			// apply the 1d inverse DCT for each row
			for (ri = 0; ri < 8; ri += 1) {
				ci = ri * 8;
				y = dqc.slice(ci, ci + 8);
				x = this.invertDCT1D(y);
				res[ri] = x;
			}

			// apply the 1d inverse DCT for each column
			for (ci = 0; ci < 8; ci += 1) {
				for (ri = 0; ri < 8; ri += 1) {
					y[ri] = res[ri][ci];
				}
				x = this.invertDCT1D(y);
				for (ri = 0; ri < 8; ri += 1) {
					res[ri][ci] = (x[ri] + 8) >> 4;
				}
			}

			return res;
		},

		/**
		 *
		 *
		 * @method setPixels1
		 * @private
		 * @param {Array} recp Pointer to the current plane to reconstruct
		 * @param {Number} pli The color plane index of the current block
		 * @param {Number} by Vertical pixel index of the lower-left corner of the current block
		 * @param {Number} bx Horizontal pixel index of the lower-left corner of the current block
		 * @param {Array} pred Predictor values to use for the current block
		 * @param {Number} dc The dequantized DC coefficient of a block
		 */
		setPixels1: function (recp, pli, by, bx, pred, dc) {
				// The vertical pixel index in the block
			var biy,

				// The horizontal pixel index in the block
				bix,

				// The horizontal pixel index in the current plane
				px,

				// The vertical pixel index in the current plane
				py,

				// A reconstructed pixel value
				p;

			for (biy = 0; biy < 8; biy += 1) {
				// y coordinate of the pixel
				py = by + biy;

				// init, if not exists
				if (!recp[py]) {
					recp[py] = [];
				}

				for (bix = 0; bix < 8; bix += 1) {
					// x coordinate of the pixel
					px = bx + bix;

					// calculate the pixel value
					p = pred[biy][bix] + dc;
					// clamp
					if (p > 255) {
						p = 255;
					} else if (p < 0) {
						p = 0;
					}

					if (pli === 0) {
						this.changedPixels.push([px, py]);
					}

					recp[py][px] = p;
				}
			}
		},

		/**
		 *
		 *
		 * @method setPixels2
		 * @private
		 * @param {Array} recp Pointer to the current plane to reconstruct
		 * @param {Number} pli The color plane index of the current block
		 * @param {Number} by Vertical pixel index of the lower-left corner of the current block
		 * @param {Number} bx Horizontal pixel index of the lower-left corner of the current block
		 * @param {Array} pred Predictor values to use for the current block
		 * @param {Array} res The decoded residual for the current block
		 */
		setPixels2: function (recp, pli, by, bx, pred, res) {
			var biy,
				bix,
				py,
				px,
				p;

			for (biy = 0; biy < 8; biy += 1) {
				// y coordinate of the pixel
				py = by + biy;

				// init, if not exists
				if (!recp[py]) {
					recp[py] = [];
				}

				for (bix = 0; bix < 8; bix += 1) {
					// x coordinate of the pixel
					px = bx + bix;

					// calculate the pixel value
					p = pred[biy][bix] + res[biy][bix];
					// clamp
					if (p > 255) {
						p = 255;
					} else if (p < 0) {
						p = 0;
					}

					if (pli === 0) {
						this.changedPixels.push([px, py]);
					}

					recp[py][px] = p;
				}
			}
		},

		/**
		 * This procedure takes all decoded data from the input packet and reconstruct the whole frame.
		 *
		 * @method reconstructComplete
		 * @private
		 */
		reconstructComplete: function () {
				// The width of the current plane pixels
			var rpw,

				// The Height of the current plane pixels
				rph,

				// Content of the current plane of the reference frame
				refp,

				// Pointer to the current plane of the current frame
				recp,

				// Horizontal pixel index of the lower-left corner of the current block
				bx,

				// Vertical pixel index of the lower-left corner of the current block
				by,

				// Horizontal component of the first whole-pixel motion vector
				mvx,

				// Vertical component of the first whole-pixel motion vector
				mvy,

				// Horizontal component of the second whole-pixel motion vector
				mvx2,

				// Vertical component of the second whole-pixel motion vector
				mvy2,

				// Predictor values to use for the current block
				pred,

				// The decoded residual for the current block
				res = [],

				// A quantization matrix
				qmat,

				// The dequantized DC coefficient of a block
				dc,

				// The index of the current block in coded order
				bi,

				// The index of the current block in raster order
				bri,

				// The index of the macro block containing block bi
				mbi,

				// The color plane index of the current block
				pli = 0,

				// The index of the reference frame
				rfi,

				// A quantization type index
				qti,

				// The quantization index of the DC coefficient
				qi0,

				// The quantization index of the AC coefficients
				qi,

				// A array of dequantized DCT coefficients in natural order
				dqc,

				// Cached length for loops
				len,

				i,

				divX = 2,
				divY = 2;

			/**
			 * RPYH*RPYW Array of pixel values of the Y plane.
			 *
			 * @property recy
			 * @type {Array}
			 */
			this.recy = [];

			/**
			 * RPCH*RPCW Array of pixel values of the Cb plane.
			 *
			 * @property reccb
			 * @type {Array}
			 */
			this.reccb = [];

			/**
			 * RPCH*RPCW Array of pixel values of the Cr plane.
			 *
			 * @property reccr
			 * @type {Array}
			 */
			this.reccr = [];

			// if we have an inter frame
			// uncoded blocks will copied from
			// the previous frame
			if (this.ftype !== 0) {
				// 2-level deep array cope
				len = this.prevrefy.length;
				for (i = 0; i < len; i += 1) {
					this.recy[i] = this.prevrefy[i].slice(0);
				}
				len = this.prevrefcb.length;
				for (i = 0; i < len; i += 1) {
					this.reccb[i] = this.prevrefcb[i].slice(0);
				}
				len = this.prevrefcr.length;
				for (i = 0; i < len; i += 1) {
					this.reccr[i] = this.prevrefcr[i].slice(0);
				}
			}

			recp = this.recy;

			qi0 = this.qis[0];

			rpw = this.rpyw;
			rph = this.rpyh;

			// for all coded blocks
			len = this.codedBlocks.length;
			for (i = 0; i < len; i += 1) {
				bi = this.codedBlocks[i];
				bri = tables.codedToRasterOrder[bi];
				mbi = tables.biToMbi[bi];
				rfi = constants.REFERENCE_FRAME_INDICIES[this.mbmodes[mbi]];
				qti = this.mbmodes[mbi] === 1 ? 0 : 1;

				// determine the current color plane
				if (bi >= header.nlbs) {
					rpw = this.rpcw;
					rph = this.rpch;

					if (bi >= header.nlbs + header.ncbs) {
						pli = 2;
						recp = this.reccr;
					} else {
						pli = 1;
						recp = this.reccb;
					}
				}


				// calculate the absolute x and y pixel coordinates
				// of the lower left pixel in block bi
				bx = ((bri - colorPlaneOffsets[pli]) * 8) % rpw;
				by = (((bri - colorPlaneOffsets[pli]) * 8) - bx) / rpw * 8;

				// get the pixel predictor corresponding
				// to the current frame type and color plane index
				if (rfi === 0) {
					pred = constants.INTRA_PREDICTOR;
				} else {
					// get the current plane of the reference frame
					refp = this.referenceFrames[rfi][pli];

					if (pli > 0) {
						if (header.pf === 0) {
							divX = 4;
							divY = 4;
						} else if (header.pf === 2) {
							divX = 4;
						}
					}

					mvx = Math.floor(Math.abs(this.mvects[bi][0]) / divX) * util.sign(this.mvects[bi][0]);
					mvy = Math.floor(Math.abs(this.mvects[bi][1]) / divY) * util.sign(this.mvects[bi][1]);
					mvx2 = Math.ceil(Math.abs(this.mvects[bi][0]) / divX) * util.sign(this.mvects[bi][0]);
					mvy2 = Math.ceil(Math.abs(this.mvects[bi][1]) / divY) * util.sign(this.mvects[bi][1]);

					if (mvx === mvx2 && mvy === mvy2) {
						pred = this.getWholePixelPredictor(rpw, rph, refp, bx, by, mvx, mvy);
					} else {
						pred = this.getHalfPixelPredictor(rpw, rph, refp, bx, by, mvx, mvy, mvx2, mvy2);
					}
				}

				if (this.ncoeffs[bi] < 2) {
					// get the DC quantization matrix
					qmat = header.qmats[qti][pli][qi0];

					dc = (this.coeffs[bi][0] * qmat[0] + 15) >> 5;
					// truncate dc to a signed 16-bit representation
					if (dc >= 32768) {
						dc = 32768;
					} else if (dc <= -32768) {
						dc = -32768;
					}

					this.setPixels1(recp, pli, by, bx, pred, dc);

				} else {
					qi = this.qis[this.qiis[bi]];
					dqc = this.dequantize(qti, pli, qi0, qi, bi);
					res = this.invertDCT2D(dqc);
					this.setPixels2(recp, pli, by, bx, pred, res);
				}
			}
		},

		/**
		 * Filter response is modulation.
		 *
		 * @method getLflim
		 * @private
		 * @param {Number} r
		 * @param {Number} l The limiting value
		 * @return {Number}
		 */
		getLflim: function (r, l) {
			var pl2;

			if ((-l) < r && r < l) {
				return r;
			}

			pl2 = l * 2;
			if (r <= pl2 || pl2 <= r) {
				return 0;
			}

			if (r <= l) {
				return -r - pl2;
			}

			return -r + pl2;
		},

		/**
		 * This procedure applies a 4-tap horizontal filter to each row of a vertical block edge.
		 *
		 * @method filterHorizontal
		 * @private
		 * @param {Array} recp Contents of a plane of the reconstructed frame
		 * @param {Number} fx The horizontal pixel index of the lower-left corner of the area to be filtered
		 * @param {Number} fy The vertical pixel index of the lower-left corner of the area to be filtered
		 * @param {Number} l The loop filter limit value
		 */
		filterHorizontal: function (recp, fx, fy, l) {
				// The edge detector response
			var r,

				// A filtered pixel value
				p,

				// The vertical pixel index in the block
				by,

				// The modulated filter limit value
				lflim,

				// The vertical pixel index in the plane
				py,

				fx1 = fx + 1,
				fx2 = fx + 2,
				fx3 = fx + 3;

			for (by = 0; by < 8; by += 1) {
				py = fy + by;

				r = (recp[py][fx] - 3 * recp[py][fx1] + 3 * recp[py][fx2] - recp[py][fx3] + 4) >> 3;

				lflim = this.getLflim(r, l);

				p = recp[py][fx1] + lflim;
				// clamp
				if (p > 255) {
					p = 255;
				} else if (p < 0) {
					p = 0;
				}
				recp[py][fx1] = p;

				p = recp[py][fx2] - lflim;
				// clamp
				if (p > 255) {
					p = 255;
				} else if (p < 0) {
					p = 0;
				}
				recp[py][fx2] = p;
			}
		},

		/**
		 * This procedure applies a 4-tap vertical filter to each column of a horizontal block edge.
		 *
		 * @method filterHorizontal
		 * @private
		 * @param {Array} recp Contents of a plane of the reconstructed frame
		 * @param {Number} fx The horizontal pixel index of the lower-left corner of the area to be filtered
		 * @param {Number} fy The vertical pixel index of the lower-left corner of the area to be filtered
		 * @param {Number} l The loop filter limit value
		 */
		filterVertical: function (recp, fx, fy, l) {
				// The edge detector response
			var r,

				// A filtered pixel value
				p,

				// The horizontal pixel index in the block
				bx,

				// The modulated filter limit value
				lflim,

				// The horizontal pixel index in the plane
				px,

				fy1 = fy + 1,
				fy2 = fy + 2,
				fy3 = fy + 3;

			for (bx = 0; bx < 8; bx += 1) {
				px = fx + bx;

				r = (recp[fy][px] - 3 * recp[fy1][px] + 3 * recp[fy2][px] - recp[fy3][px] + 4) >> 3;

				lflim = this.getLflim(r, l);

				p = recp[fy1][px] + lflim;
				// clamp
				if (p > 255) {
					p = 255;
				} else if (p < 0) {
					p = 0;
				}
				recp[fy1][px] = p;

				p = recp[fy2][px] - lflim;
				// clamp
				if (p > 255) {
					p = 255;
				} else if (p < 0) {
					p = 0;
				}
				recp[fy2][px] = p;
			}
		},

		/**
		 * This procedure defines the order that the various block edges are filtered.
		 *
		 * @method filterLoopComplete
		 * @private
		 */
		filterLoopComplete: function () {
				// The width of the current plane of in pixels
			var rpw,

				// The height of the current plane of in pixels
				rph,

				// Contents of the current plane
				recp,

				// The horizontal pixel index of the lower-left corner of the current block
				bx,

				// The vertical pixel index of the lower-left corner of the current block
				by,

				// The horizontal pixel index of the lower-left corner of the area to be filtered
				fx,

				// The vertical pixel index of the lower-left corner of the area to be filtered
				fy,

				// The loop filter limit value
				l,

				// The color plane index of the current block
				pli = 0,

				// The current block index in coded order
				bi,

				// The index of a neighboring block in coded order
				bj,

				// The current block index in raster order
				bri;

			l = header.lflims[this.qis[0]];

			// loop through all blocks in raster order
			for (bri = 0; bri < header.nbs; bri += 1) {

				// get the current block index in coded order
				bi = tables.rasterToCodedOrder[bri];

				if (this.bcoded[bi] !== 0) {
					switch (pli) {
					case 0:
						recp = this.recy;
						rpw = this.rpyw;
						rph = this.rpyh;
						break;
					case 1:
						recp = this.reccb;
						rpw = this.rpcw;
						rph = this.rpch;
						break;
					default:
						recp = this.reccr;
						rpw = this.rpcw;
						rph = this.rpch;
						break;
					}

					// calculate the absolute x and y pixel coordinates
					// of the lower left pixel in block bi
					bx = ((bri - colorPlaneOffsets[pli]) * 8) % rpw;
					by = (((bri - colorPlaneOffsets[pli]) * 8) - bx) / rpw * 8;

					if (bx > 0) {
						fx = bx - 2;
						fy = by;
						this.filterHorizontal(recp, fx, fy, l);
					}
					if (by > 0) {
						fx = bx;
						fy = by - 2;
						this.filterVertical(recp, fx, fy, l);
					}
					if ((bx + 8) < rpw) {
						bj = tables.rasterToCodedOrder[bri + 1];
						if (this.bcoded[bj] === 0) {
							fx = bx + 6;
							fy = by;
							this.filterHorizontal(recp, fx, fy, l);
						}
					}
					if ((by + 8) < rph) {
						bj = tables.rasterToCodedOrder[(bri  + rpw / 8)];
						if (this.bcoded[bj] === 0) {
							fx = bx;
							fy = by + 6;
							this.filterVertical(recp, fx, fy, l);
						}
					}
				}

				if (bri >= header.nlbs + header.ncbs - 1) {
					pli = 2;
				} else if (bri >= header.nlbs - 1) {
					pli = 1;
				}
			}
		}

	};

	// export
	return Constructor;
}());

/**
 * The decoder can decode frames from a theora input stream.
 * The frames will be iterated in a consecuative way, such as they come from the input stream.
 * Random access isn’t possible yet.
 *
 * @class decoder
 * @namespace Theora
 * @static
 */
TheoraJS.namespace("Theora").decoder = (function () {
	"use strict";

		/* dependencies */
	var header = TheoraJS.namespace("Theora").header,
		Frame = TheoraJS.namespace("Theora").Frame,
		util = TheoraJS.namespace("Theora").util,
		mappingTables = TheoraJS.namespace("Theora").mappingTables,

		/* private */
		stream,
		tables;

	/**
	 * Generates all mapping tables which are shared for all frames.
	 *
	 * @method computeMappingTables
	 * @private
	 */
	function computeMappingTables() {
		var table,
			sizes = [],
			offset = 0;

		tables = {};

		sizes[0] = mappingTables.computeSuperBlockSizes(header.flbw, header.flbh);
		sizes[1] = mappingTables.computeSuperBlockSizes(header.fcbw, header.fcbh);
		sizes[2] = sizes[1];
		tables.superBlockSizes = sizes[0].concat(sizes[1]).concat(sizes[2]);

		table = mappingTables.computeBlockToSuperBlockTable(header.flbw, header.flbh, sizes[0], offset);

		offset += sizes[0].length;
		table.push.apply(table,
						mappingTables.computeBlockToSuperBlockTable(header.fcbw, header.fcbh, sizes[1], offset));

		offset += sizes[1].length;
		table.push.apply(table,
						mappingTables.computeBlockToSuperBlockTable(header.fcbw, header.fcbh, sizes[2], offset));

		tables.biToSbi = table;

		offset = 0;
		table = mappingTables.computeRasterToCodedOrderMappingTable(
			header.flbw,
			header.flbh,
			tables.biToSbi,
			tables.superBlockSizes,
			offset
		);

		offset += header.nlbs;
		table.push.apply(table, mappingTables.computeRasterToCodedOrderMappingTable(
			header.fcbw,
			header.fcbh,
			tables.biToSbi,
			tables.superBlockSizes,
			offset
		));

		offset += header.ncbs;
		table.push.apply(table, mappingTables.computeRasterToCodedOrderMappingTable(
			header.fcbw,
			header.fcbh,
			tables.biToSbi,
			tables.superBlockSizes,
			offset
		));

		tables.rasterToCodedOrder = table;
		tables.codedToRasterOrder = util.arrayFlip(table);

		table = mappingTables.computeMacroBlockMappingTables(
			header.fmbw,
			header.fmbh,
			header.pf,
			tables.rasterToCodedOrder
		);

		tables.biToMbi = table[0];
		tables.mbiToBi = table[1];
	}


	// export public methods
	return {
		/**
		 * 
		 *
		 * @method setInputStream
		 * @param {Ogg.LogicalStream} stream Input stream.
		 */
		setInputStream: function (inputStream) {
			stream = inputStream;

			// decode all 3 theora headers
			header.decodeIdentificationHeader(stream.nextPacket());
			header.decodeCommentHeader(stream.nextPacket());
			header.decodeSetupHeader(stream.nextPacket());

			// pre-compute all quantization matrices
			header.computeQuantizationMatrices();

			// pre-compute all needed mapping tables
			computeMappingTables();

			// make the mapping tables available for all frames
			Frame.setMappingTables(tables);

			/**
			 * Frame width in pixel.
			 *
			 * @property width
			 * @type {Number}
			 */
			this.width = header.picw;

			/**
			 * Frame height in pixel.
			 *
			 * @property height
			 * @type {Number}
			 */
			this.height = header.pich;

			/**
			 * Bitrate of the video stream.
			 *
			 * @property bitrate
			 * @type {Number}
			 */
			this.bitrate = header.nombr;

			/**
			 * Comments decoded from the comment header.
			 * This is a key <-> value hash map.
			 *
			 * @property comments
			 * @type {Object}
			 */
			this.comments = header.comments;

			/**
			 * Vendor name, set by the encoder.
			 *
			 * @property vendor
			 * @type {String}
			 */
			this.vendor = header.vendor;

			/**
			 * The framerate of the video.
			 *
			 * @property framerate
			 * @type {Number}
			 */
			this.framerate = header.frn / header.frd;

			/**
			 * Pixel format. The subsampling mode. 
			 * 0 = 4:2:0 subsampling 
			 * 2 = 4:2:2 subsampling 
			 * 3 = 4:4:4 subsampling 
			 *
			 * @property pixelFormat
			 * @type {Number}
			 */
			this.pixelFormat = header.pf;

			/**
			 * X offset of the picture region
			 *
			 * @property xOffset
			 */
			this.xOffset = header.picx;

			/**
			 * Y offset of the picture region
			 *
			 * @property yOffset
			 */
			this.yOffset = header.picy;
		},

		/**
		 * Get the next frame in the stream.
		 * 
		 * @method nextFrame
		 * @return {Object}
		 */
		nextFrame: function () {
			var packet = stream.nextPacket(),
				frame;

			if (!packet) {
				return false;
			}

			frame = new Frame(packet, this.goldReferenceFrame, this.prefReferenceFrame);
			frame.decode();

			if (frame.ftype === 0) {
				this.goldReferenceFrame = frame;
			}
			this.prefReferenceFrame = frame;

			return frame;
		}

	};
}());
