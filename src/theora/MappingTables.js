/**
 * Collection of methods that generates all kind of mapping tables.
 *
 * @class mappingTables
 * @namespace Theora
 * @static
 */
TheoraJS.namespace('Theora').mappingTables = (function() {
    'use strict';

    // Dependencies
    const { constants } = TheoraJS.namespace('Theora');

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
        const sizes = [];

        // Current super block row
        let row;

        // Current super block column
        let col;

        // Width in super blocks
        let superBlocksWidth = (width - (width % 4)) / 4;

        // Height in super blocks
        let superBlocksHeight = (height - (height % 4)) / 4;

        // Height of the current super blocks
        let currentHeight = 4;

        // Height of the super blocks in the top row
        let partialHeight = 4;

        // Width of the super blocks in the right column
        let partialWidth = 4;

        // Check if there are partial super blocks on the top or right edge
        if (superBlocksWidth < width / 4) {
            // Calculate the with of each super block in the last column
            partialWidth = width - 4 * superBlocksWidth;

            // Increase width of super blocks
            superBlocksWidth += 1;
        }

        if (superBlocksHeight < height / 4) {
            // Calculate the height of each super block in the top row
            partialHeight = height - 4 * superBlocksHeight;

            // Increase the height of super blocks
            superBlocksHeight += 1;
        }

        // Iterating through the super block rows and cols of the plane
        for (row = 0; row < superBlocksHeight; row += 1) {
            // Determine the height of the current super block,
            // which will be 4 except for the last row
            if (row < superBlocksHeight - 1) {
                currentHeight = 4;
            } else {
                currentHeight = partialHeight;
            }

            // Iterating through each column of the row except the last
            for (col = 0; col < superBlocksWidth - 1; col += 1) {
                sizes[row * superBlocksWidth + col] = currentHeight * 4;
            }

            // Last super block in the current row,
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
        // Block to super block mapping table
        const table = [];

        // Number of the blocks in the plane
        const numberOfBlocks = width * height;

        // Block index in coded order
        let bi;

        // Index of the current super block
        let sbi = 0;

        // Block index of the first block in current super block
        let firstBi = 0;

        // Set offset to 0, if not defined
        offset = offset || 0;

        // Loop through all blocks in coded order
        for (bi = 0; bi < numberOfBlocks; bi += 1) {
            // Check if a new super block begins
            if (bi - (firstBi + sizes[sbi]) === 0) {
                firstBi += sizes[sbi];
                sbi += 1;
            }

            // Map bi to sbi
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
    function computeRasterToCodedOrderMappingTable(
        width,
        height,
        mappingTable,
        sizes,
        offset
    ) {
        // Mapping table
        const table = [];

        // Index of the current block in coded order
        let bi;

        // Index of the current super block
        let sbi;

        // Total number of blocks
        const numberOfBlocks = width * height;

        // Position of the row corresponding to the first block of the current super block
        let row = 0;

        // Position of the col corresponding to the first block of the current super block
        let col = 0;

        // Absolute position of the row of the current block
        let blockRow;

        // Absolute position of the col of the current block
        let blockCol;

        // Width of the current super block
        let superBlockWidth = 4;

        // Height of the current super block
        let superBlockHeight = 4;

        // Index of the first block corresponding to the current super block
        let firstBi = 0;

        // Relative index of a block corresponding to a super block
        let relativeBi = 0;

        // Initialize sbi with the index of the super block corresponding to block 0
        sbi = mappingTable[offset];

        // Adjust the dimensions of the first super block,
        // if it contains not all 16 block
        if (sizes[sbi] !== 16) {
            if (width < 4) {
                superBlockWidth = width;
            }

            if (height < 4) {
                superBlockHeight = height;
            }
        }

        // Loop through all blocks in coded order
        for (bi = 0; bi < numberOfBlocks; bi += 1) {
            // Check if a new super block begins
            if (mappingTable[offset + bi] > sbi) {
                // Update the column of the first block in the current super block
                col += superBlockWidth;

                // Check if we have to jump to the next row
                if (col >= width) {
                    col = 0;
                    row += superBlockHeight;
                }

                // Update the block index of the first block in the current super block
                firstBi += sizes[sbi];

                // Update the dimensions of the new super block
                if (col + 4 <= width) {
                    // Normal super block width
                    superBlockWidth = 4;
                } else {
                    // Partial super block, calculate the remaining blocks to the right edge
                    superBlockWidth = width - col;
                }

                if (row + 4 <= height) {
                    // Normal super block height
                    superBlockHeight = 4;
                } else {
                    // Partial super block, calculate the remaining blocks to the top edge
                    superBlockHeight = height - row;
                }

                // Increase super block index
                sbi += 1;
            }

            // Assign block index in coded order relative to the current super block
            relativeBi = bi - firstBi;

            // Determine the absolute position of row and col
            // from the current block in the color plane
            blockRow =
                row +
                constants.ROW_MAPPING_TABLE[superBlockWidth - 1][
                    superBlockHeight - 1
                ][relativeBi];
            blockCol =
                col +
                constants.COLUMN_MAPPING_TABLE[superBlockWidth - 1][
                    superBlockHeight - 1
                ][relativeBi];

            // Map the raster index to coded order bi
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
    function computeMacroBlockMappingTables(
        frameWidth,
        frameHeight,
        pixelFormat,
        rasterToCodedOrder
    ) {
        // The mapping tables
        const tables = [];

        // The index of the current block in coded order
        let bi = 0;

        // The index of the current block in raster order
        let bri = 0;

        // The column of the current macro block
        let col = 0;

        // The row of the current macro block
        let row = 0;

        // Flag that indicates if the row of a macro blog is odd or even
        let isOddRow = 0;

        // The index of the current macro block
        let mbi = 0;

        // Width of a single macro block in blocks
        let macroBlockWidth = 2;

        // Height of a single macro block in blocks
        let macroBlockHeight = 2;

        // The index of the current color plane
        let pli = 0;

        // The relative position of the macro block in its current row
        let xOffset;

        // Iterators to loop through the dimensions of a macro block
        let i;
        let j;

        // Macro blocks will be accessed in coded order within a super block.
        // A super block contains 2*2 macro blocks. The lower-left has the index 0,
        // upper-left 1, upper-right 2 and lower-right 3.
        // To map the coded block indicies to the coded macro block indicies we will
        // iterate through the macro blocks in raster order.

        tables[0] = [];
        tables[1] = [];

        // For all color planes
        for (pli = 0; pli < 3; pli += 1) {
            // Adjust some values if current plane is a chroma plane
            if (pli !== 0) {
                // Change dimensions of macro blocks corresponding to the pixel format
                if (pixelFormat === 0) {
                    // Subsampling 4:2:0
                    macroBlockWidth = 1;
                    macroBlockHeight = 1;
                } else if (pixelFormat === 2) {
                    // Subsampling 4:2:2
                    macroBlockWidth = 1;
                    macroBlockHeight = 2;
                }
            }

            // For each row of macro blocks
            for (row = 0; row < frameHeight; row += 1) {
                // Determine if the row is odd or even
                isOddRow = row % 2;

                // For each block row within a macro block
                for (i = 0; i < macroBlockHeight; i += 1) {
                    // Start value of xOffset depends on the parity of the row
                    xOffset = isOddRow;

                    // For each column of macro blocks
                    for (col = 0; col < frameWidth; col += 1) {
                        // Calculate the coded order index of the current macro block
                        mbi = (row - isOddRow) * frameWidth + xOffset;

                        // Init, table entry if not exists
                        if (typeof tables[1][mbi] === 'undefined') {
                            tables[1][mbi] = [];
                        }

                        // For each block column within a macro block
                        for (j = 0; j < macroBlockWidth; j += 1) {
                            // Get the block index in coded order
                            bi = rasterToCodedOrder[bri];

                            // Increase the block index in raster order
                            bri += 1;

                            // Map bi to mbi
                            tables[0][bi] = mbi;
                            tables[1][mbi].push(bi);
                        }

                        // The next xOffset will be increased by 1,
                        // if a new super block begins and 3 if we stay in the same super block.
                        // If we are in the last row, where is a parital super block
                        // we don’t have to use the coded order
                        if (
                            col % 2 === isOddRow &&
                            !(row === frameHeight - 1 && isOddRow === 0)
                        ) {
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

    // Export public methods
    return {
        computeSuperBlockSizes,
        computeBlockToSuperBlockTable,
        computeRasterToCodedOrderMappingTable,
        computeMacroBlockMappingTables
    };
})();
