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
