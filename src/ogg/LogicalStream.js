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
