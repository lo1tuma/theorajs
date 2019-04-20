/* Dependencies */
const { header } = TheoraJS.namespace('Theora');
const { Frame } = TheoraJS.namespace('Theora');
const { util } = TheoraJS.namespace('Theora');
const { mappingTables } = TheoraJS.namespace('Theora');

/* Private */
let stream;
let tables;

/**
     * Generates all mapping tables which are shared for all frames.
     *
     * @method computeMappingTables
     * @private
     */
function computeMappingTables() {
    let table;
    const sizes = [];
    let offset = 0;

    tables = {};

    sizes[0] = mappingTables.computeSuperBlockSizes(
        header.flbw,
        header.flbh
    );
    sizes[1] = mappingTables.computeSuperBlockSizes(
        header.fcbw,
        header.fcbh
    );
    sizes[2] = sizes[1];
    tables.superBlockSizes = sizes[0].concat(sizes[1]).concat(sizes[2]);

    table = mappingTables.computeBlockToSuperBlockTable(
        header.flbw,
        header.flbh,
        sizes[0],
        offset
    );

    offset += sizes[0].length;
    table.push.apply(
        table,
        mappingTables.computeBlockToSuperBlockTable(
            header.fcbw,
            header.fcbh,
            sizes[1],
            offset
        )
    );

    offset += sizes[1].length;
    table.push.apply(
        table,
        mappingTables.computeBlockToSuperBlockTable(
            header.fcbw,
            header.fcbh,
            sizes[2],
            offset
        )
    );

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
    table.push.apply(
        table,
        mappingTables.computeRasterToCodedOrderMappingTable(
            header.fcbw,
            header.fcbh,
            tables.biToSbi,
            tables.superBlockSizes,
            offset
        )
    );

    offset += header.ncbs;
    table.push.apply(
        table,
        mappingTables.computeRasterToCodedOrderMappingTable(
            header.fcbw,
            header.fcbh,
            tables.biToSbi,
            tables.superBlockSizes,
            offset
        )
    );

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

export class Decoder {
    /**
         *
         *
         * @method setInputStream
         * @param {Ogg.LogicalStream} stream Input stream.
         */
    setInputStream(inputStream) {
        stream = inputStream;

        // Decode all 3 theora headers
        header.decodeIdentificationHeader(stream.nextPacket());
        header.decodeCommentHeader(stream.nextPacket());
        header.decodeSetupHeader(stream.nextPacket());

        // Pre-compute all quantization matrices
        header.computeQuantizationMatrices();

        // Pre-compute all needed mapping tables
        computeMappingTables();

        // Make the mapping tables available for all frames
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
    }

    /**
         * Get the next frame in the stream.
         *
         * @method nextFrame
         * @return {Object}
         */
    nextFrame() {
        const packet = stream.nextPacket();
        let frame;

        if (!packet) {
            return false;
        }

        frame = new Frame(
            packet,
            this.goldReferenceFrame,
            this.prefReferenceFrame
        );
        frame.decode();

        if (frame.ftype === 0) {
            this.goldReferenceFrame = frame;
        }

        this.prefReferenceFrame = frame;

        return frame;
    }
}
