import { ByteStream } from '../stream/byteStream';
import { OggError } from './errors';

export class Page {
    public capturePattern: string;

    public version: number;

    public headerType: number;

    public granulePosition: number;

    public serialNumber: number;

    public pageSequenceNumber: number;

    public checksum: number;

    public pageSegments: number;

    public segmentTable: number[];

    public segments: Uint8Array[];

    public headerLength: number;

    public bodyLength: number;

    private stream: ByteStream;

    constructor(stream: ByteStream) {
        let i;

        this.stream = stream;

        /**
         * Ogg capture pattern. Bytes 1-4, must be 'OggS'.
         *
         * @property capturePattern
         * @type String
         */
        this.capturePattern = String.fromCharCode(stream.next8(), stream.next8(), stream.next8(), stream.next8());

        // Check for valid ogg page
        if (!this.isValid()) {
            throw new OggError('Page has invalid capturePattern.');
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

        // Read the segment table
        for (i = 0; i < this.pageSegments; i += 1) {
            this.segmentTable[i] = stream.next8();
            this.bodyLength += this.segmentTable[i];
        }

        // Read all segments
        for (i = 0; i < this.pageSegments; i += 1) {
            this.segments.push(this.stream.nextArray(this.segmentTable[i]));
        }
    }

    /**
     * Checks if the page has a valid capturePattern.
     *
     * @method isValid
     * @return {Boolean}
     */
    isValid(): boolean {
        return this.capturePattern === 'OggS';
    }

    /**
     * Checks if the page is a continued page or the first page within a logical stream.
     *
     * @method isContinuedPage
     * @return {Boolean}
     */
    isContinuedPage(): boolean {
        // Check bit flag
        return (this.headerType & 0x01) === 0x01;
    }

    /**
     * Checks if the page is the last page within a logical stream.
     *
     * @method isEndOfStream
     * @return {Boolean}
     */
    isEndOfStream(): boolean {
        // Check bit flag
        return (this.headerType & 0x04) === 0x04;
    }

    /**
     * Checks if the page is the first page within a logical stream.
     *
     * @method isBeginOfStream
     * @return {Boolean}
     */
    isBeginOfStream(): boolean {
        // Check bit flag
        return (this.headerType & 0x02) === 0x02;
    }
}
