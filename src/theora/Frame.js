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
