import { LogicalStream } from '../ogg/logicalStream';
import { Packet } from '../ogg/packet';
import { Header } from './header';
import { Frame } from './frame';
import { arrayFlip } from './util';
import {
    computeMacroBlockMappingTables,
    computeSuperBlockSizes,
    computeRasterToCodedOrderMappingTable,
    computeBlockToSuperBlockTable
} from './mappingTables';

export interface MappingTables {
    biToSbi: number[];
    rasterToCodedOrder: number[];
    codedToRasterOrder: number[];
    biToMbi: number[];
    mbiToBi: number[][];
    superBlockSizes: number[];
}

/**
 * Generates all mapping tables which are shared for all frames.
 *
 * @method computeMappingTables
 * @private
 */
function computeMappingTables(header: Header): MappingTables {
    let table;
    const sizes = [];
    let offset = 0;

    sizes[0] = computeSuperBlockSizes(header.flbw, header.flbh);
    sizes[1] = computeSuperBlockSizes(header.fcbw, header.fcbh);
    sizes[2] = sizes[1];
    const superBlockSizes = sizes[0].concat(sizes[1]).concat(sizes[2]);

    table = computeBlockToSuperBlockTable(header.flbw, header.flbh, sizes[0], offset);

    offset += sizes[0].length;
    table.push(...computeBlockToSuperBlockTable(header.fcbw, header.fcbh, sizes[1], offset));

    offset += sizes[1].length;
    table.push(...computeBlockToSuperBlockTable(header.fcbw, header.fcbh, sizes[2], offset));

    const biToSbi = table;

    offset = 0;
    table = computeRasterToCodedOrderMappingTable(header.flbw, header.flbh, biToSbi, superBlockSizes, offset);

    offset += header.nlbs;
    table.push(...computeRasterToCodedOrderMappingTable(header.fcbw, header.fcbh, biToSbi, superBlockSizes, offset));

    offset += header.ncbs;
    table.push(...computeRasterToCodedOrderMappingTable(header.fcbw, header.fcbh, biToSbi, superBlockSizes, offset));

    const rasterToCodedOrder = table;
    const codedToRasterOrder = arrayFlip(table);

    table = computeMacroBlockMappingTables(header.fmbw, header.fmbh, header.pf, rasterToCodedOrder);

    const biToMbi = table[0];
    const mbiToBi = table[1];

    return {
        biToSbi,
        biToMbi,
        mbiToBi,
        rasterToCodedOrder,
        codedToRasterOrder,
        superBlockSizes
    };
}

export class Decoder {
    public width: number;

    public height: number;

    public bitrate: number;

    public comments: Header['comments'];

    public vendor: string;

    public framerate: number;

    public pixelFormat: number;

    public xOffset: number;

    public yOffset: number;

    private stream: LogicalStream;

    private header: Header;

    private mappingTables: MappingTables;

    private colorPlaneOffsets: number[];

    private goldReferenceFrame?: Frame;

    private prevReferenceFrame?: Frame;

    /**
     *
     *
     * @method setInputStream
     * @param {Ogg.LogicalStream} stream Input stream.
     */
    constructor(inputStream: LogicalStream) {
        this.stream = inputStream;

        this.header = new Header();

        // Decode all 3 theora headers
        this.header.decodeIdentificationHeader(this.stream.nextPacket() as Packet);
        this.header.decodeCommentHeader(this.stream.nextPacket() as Packet);
        this.header.decodeSetupHeader(this.stream.nextPacket() as Packet);

        // Pre-compute all quantization matrices
        this.header.computeQuantizationMatrices();

        // Pre-compute all needed mapping tables
        this.mappingTables = computeMappingTables(this.header);

        this.colorPlaneOffsets = [0, this.header.nlbs, this.header.nlbs + this.header.ncbs];

        /**
         * Frame width in pixel.
         *
         * @property width
         * @type {Number}
         */
        this.width = this.header.picw;

        /**
         * Frame height in pixel.
         *
         * @property height
         * @type {Number}
         */
        this.height = this.header.pich;

        /**
         * Bitrate of the video stream.
         *
         * @property bitrate
         * @type {Number}
         */
        this.bitrate = this.header.nombr;

        /**
         * Comments decoded from the comment header.
         * This is a key <-> value hash map.
         *
         * @property comments
         * @type {Object}
         */
        this.comments = this.header.comments;

        /**
         * Vendor name, set by the encoder.
         *
         * @property vendor
         * @type {String}
         */
        this.vendor = this.header.vendor;

        /**
         * The framerate of the video.
         *
         * @property framerate
         * @type {Number}
         */
        this.framerate = this.header.frn / this.header.frd;

        /**
         * Pixel format. The subsampling mode.
         * 0 = 4:2:0 subsampling
         * 2 = 4:2:2 subsampling
         * 3 = 4:4:4 subsampling
         *
         * @property pixelFormat
         * @type {Number}
         */
        this.pixelFormat = this.header.pf;

        /**
         * X offset of the picture region
         *
         * @property xOffset
         */
        this.xOffset = this.header.picx;

        /**
         * Y offset of the picture region
         *
         * @property yOffset
         */
        this.yOffset = this.header.picy;
    }

    /**
     * Get the next frame in the stream.
     *
     * @method nextFrame
     * @return {Object}
     */
    nextFrame(): Frame | false {
        const packet = this.stream.nextPacket();

        if (!packet) {
            return false;
        }

        const frame = new Frame(
            this.header,
            packet,
            this.mappingTables,
            this.colorPlaneOffsets,
            this.goldReferenceFrame,
            this.prevReferenceFrame
        );

        frame.decode();

        if (frame.ftype === 0) {
            this.goldReferenceFrame = frame;
        }

        this.prevReferenceFrame = frame;

        return frame;
    }
}
