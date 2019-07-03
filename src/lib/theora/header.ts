import { Packet } from '../ogg/packet';
import { ilog, toInt, Bitstream } from './util';
import { TheoraError } from './errors';

/**
 * Checks if the ogg packet is a theora header.
 *
 * @method isTheora
 * @param {Ogg.Packet} packet
 * @return {Boolean}
 */
export function isTheora(packet: Packet): boolean {
    // Bytes 1-6 have to be 'Theora'
    return (
        packet.get8(1) === 0x74 &&
        packet.get8(2) === 0x68 &&
        packet.get8(3) === 0x65 &&
        packet.get8(4) === 0x6f &&
        packet.get8(5) === 0x72 &&
        packet.get8(6) === 0x61
    );
}

/**
 * Decode a 32-bit length value from packet in little endian order
 *
 * @method decodeCommentLength
 * @private
 * @param {Ogg.Packet}
 * @return {Number} Length
 */
function decodeCommentLength(packet: Packet): number {
    const len0 = packet.next8();
    const len1 = packet.next8();
    const len2 = packet.next8();
    const len3 = packet.next8();

    return len0 + (len1 << 8) + (len2 << 16) + (len3 << 24);
}

/**
 * Loop Filter Limit Table Decode
 *
 * @method decodeLFLTable
 * @private
 * @param {BitStream} reader
 * @return {Array} A 64-element array of loop filter limit values
 */
function decodeLFLTable(reader: Bitstream): number[] {
    // The quantization index
    let qi;

    // Return value
    const lflims = [];

    // The size of values being read in the current table
    const nbits = reader.nextBits(3);

    for (qi = 0; qi < 64; qi += 1) {
        // Add nbit-bit value
        lflims[qi] = reader.nextBits(nbits);
    }

    return lflims;
}

/**
 * Recursive helper function to decode a huffman tree
 *
 * @method buildSubtree
 * @private
 * @param {String} hbits A Bit-string of up to 32 bits
 * @param {BitStream} reader
 * @param {Array} Huffman table
 * @param {Number} Huffman table index
 * @param {Number} numberOfHuffmanCodeds Current number of Huffman codes
 */
function buildSubtree(
    hbits: string,
    reader: Bitstream,
    hts: number[][][],
    hti: number,
    numberOfHuffmanCodes: number
): undefined | number {
    // A single DCT token value
    let token;

    if (hbits.length > 32) {
        throw new TheoraError('Stream undecodeable.');
    }

    // Flag that indicates if the current node of the tree being decoded is a leaf node
    const isLeaf = reader.nextBits(1);
    if (isLeaf === 1) {
        if (numberOfHuffmanCodes === 32) {
            throw new TheoraError('Stream undecodeable.');
        }

        token = reader.nextBits(5);
        hts[hti][hbits.length - 1][parseInt(hbits, 2)] = token;
        numberOfHuffmanCodes += 1;
        return numberOfHuffmanCodes;
    }

    hbits += '0';
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    numberOfHuffmanCodes = buildSubtree(hbits, reader, hts, hti, numberOfHuffmanCodes) as number;

    // Remove last char
    hbits = hbits.slice(0, -1);
    hbits += '1';
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    numberOfHuffmanCodes = buildSubtree(hbits, reader, hts, hti, numberOfHuffmanCodes) as number;

    // Remove last char
    hbits = hbits.slice(0, -1);
}

/**
 * Decode all huffman tables.
 *
 * @method decodeHuffmanTables
 * @private
 * @param {BitStream} reader
 * @return {Array} 80-element array of Huffman tables with up to 32 entries each
 */
function decodeHuffmanTables(reader: Bitstream): number[][][] {
    // Return value
    const hts: number[][][] = [];

    // Huffman token index
    let hti;

    let i;

    for (hti = 0; hti < 80; hti += 1) {
        hts[hti] = [];
        for (i = 0; i < 32; i += 1) {
            hts[hti][i] = [];
        }

        buildSubtree('', reader, hts, hti, 0);
    }

    return hts;
}

export class Header {
    public vmaj: number;

    public vmin: number;

    public vrev: number;

    public fmbw: number;

    public fmbh: number;

    public picw: number;

    public pich: number;

    public picx: number;

    public picy: number;

    public frn: number;

    public frd: number;

    public parn: number;

    public pard: number;

    public cs: number;

    public nombr: number;

    public qual: number;

    public kfgshift: number;

    public pf: 0 | 2 | 3;

    public nmbs: number;

    public nlbs: number;

    public flbw: number;

    public flbh: number;

    /**
     * The number of super blocks
     *
     * @property nsbs
     */
    public nsbs: number;

    /**
     * The number of blocks
     *
     * @property nbs
     */
    public nbs: number;

    /**
     * The number of blocks in each chroma plane
     *
     * @property ncbs
     */
    public ncbs: number;

    /**
     * Frame width of each chroma plane in blocks
     *
     * @property fcbw
     */
    public fcbw: number;

    /**
     * Frame height of each chroma plane in blocks
     *
     * @property fmbh
     */
    public fcbh: number;

    public vendor: string;

    public comments: { [fieldName: string]: string };

    public lflims: number[];

    public hts: number[][][];

    public qmats: number[][][][];

    // A 64-element array of scale values for AC coefficients
    private acScale: number[];

    // A 64-element array of scale values for DC coefficients
    private dcScale: number[];

    // The number of base matrices
    private nbms: number;

    // A nbms*64 array containg all base matrices
    private bms: number[][];

    // A 2*3 array containing the number of quant ranges for a given qti and pli
    private nqrs: [[number, number, number], [number, number, number]];

    // A 2*3*63 array of the sizes of each quant range for a given qti and pli
    private qrsizes: number[][][];

    // A 2*3*64 array of the bmi’s used for each quant range for a given qti and pli
    private qrbmis: number[][][];

    constructor() {
        this.vmaj = 0;
        this.vmin = 0;
        this.vrev = 0;
        this.fmbw = 0;
        this.fmbh = 0;
        this.picw = 0;
        this.pich = 0;
        this.picx = 0;
        this.picy = 0;
        this.frn = 0;
        this.frd = 0;
        this.parn = 0;
        this.pard = 0;
        this.cs = 0;
        this.nombr = 0;
        this.qual = 0;
        this.kfgshift = 0;
        this.pf = 0;
        this.nmbs = 0;
        this.nlbs = 0;
        this.flbw = 0;
        this.flbh = 0;
        this.nsbs = 0;
        this.nbs = 0;
        this.ncbs = 0;
        this.fcbw = 0;
        this.fcbh = 0;
        this.vendor = '';
        this.comments = {};
        this.lflims = [];
        this.hts = [];
        this.qmats = [];
        this.acScale = [];
        this.dcScale = [];
        this.nbms = 0;
        this.bms = [];
        this.nqrs = [[0, 0, 0], [0, 0, 0]];
        this.qrsizes = [];
        this.qrbmis = [];
    }

    /**
     * Decodes the identification header.
     *
     * @method decodeIdentificationHeader
     * @param {Ogg.Packet} packet
     */
    decodeIdentificationHeader(packet: Packet): void {
        // The current header type
        const headerType = packet.get8(0);

        // Check the headerType and the theora signature
        if (headerType !== 0x80 && !isTheora(packet)) {
            throw new TheoraError('Invalid identification header.');
        }

        // Skip headerType and "theora" string (7 bytes)
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

        // Temporary data for bit unpacking
        // Reading 6 bit quality hint, 5 bit kfgshift, 2 bit pixel format und 3 reserved bits
        const data = packet.next16();

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
        this.kfgshift = (data >> 5) & 0x1f;

        /**
         * The pixel format
         *
         * @property pf
         */
        this.pf = ((data >> 3) & 0x03) as (0 | 2 | 3);

        // Reserved bits must be zero or we haven’t a valid stream
        if ((data & 0x07) !== 0) {
            throw new TheoraError('Invalid theora header');
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

        // Determine the correct number of blocks and super blocks corresponding to the pixel format
        // 0 = 4:2:0 subsampling
        // 2 = 4:2:2 subsampling
        // 3 = 4:4:4 subsampling
        switch (this.pf) {
            case 0:
                this.nsbs =
                    toInt((this.fmbw + 1) / 2) * toInt((this.fmbh + 1) / 2) +
                    2 * toInt((this.fmbw + 3) / 4) * toInt((this.fmbh + 3) / 4);

                this.nbs = 6 * this.fmbw * this.fmbh;

                this.ncbs = this.fmbw * this.fmbh;

                this.fcbw = this.fmbw;

                this.fcbh = this.fmbh;

                break;
            case 2:
                this.nsbs =
                    toInt((this.fmbw + 1) / 2) * toInt((this.fmbh + 1) / 2) +
                    2 * toInt((this.fmbw + 3) / 4) * toInt((this.fmbh + 1) / 2);
                this.nbs = 8 * this.fmbw * this.fmbh;

                this.ncbs = 2 * this.fmbw * this.fmbh;

                this.fcbw = this.fmbw;

                this.fcbh = 2 * this.fmbh;

                break;
            case 3:
                this.nsbs = 3 * toInt((this.fmbw + 1) / 2) * toInt((this.fmbh + 1) / 2);

                this.nbs = 12 * this.fmbw * this.fmbh;

                this.ncbs = 4 * this.fmbw * this.fmbh;

                this.fcbw = 2 * this.fmbw;

                this.fcbh = 2 * this.fmbh;

                break;
            default:
                throw new TheoraError('Unknown pixel format.');
        }
    }

    /**
     * Decodes the comment header.
     *
     * @method decodeCommentHeader
     * @param {Ogg.Packet} packet
     */
    decodeCommentHeader(packet: Packet): void {
        // The current header type
        const headerType = packet.get8(0);

        // Number of characters to read
        let len;

        // Current comment
        let comment;

        // Index of the current comment
        let ci;

        let i;

        // Check the headerType and the theora signature
        if (headerType !== 0x81 && !isTheora(packet)) {
            throw new TheoraError('Invalid comment header.');
        }

        // Skip headerType and "theora" string (7 bytes)
        packet.seek(7);

        // Get the length of the vendor string
        len = decodeCommentLength(packet);

        /**
         * The vendor string
         *
         * @property vendor
         */
        this.vendor = '';

        for (i = 0; i < len; i += 1) {
            this.vendor += String.fromCharCode(packet.next8());
        }

        // Get the number of user comments
        const ncomments = decodeCommentLength(packet);

        /**
         * Key <-> value map of all comments
         *
         * @property comments
         * @type {Object}
         */
        this.comments = {};

        for (ci = 0; ci < ncomments; ci += 1) {
            // Get raw comment
            len = decodeCommentLength(packet);
            comment = '';
            for (i = 0; i < len; i += 1) {
                comment += String.fromCharCode(packet.next8());
            }

            // Split comment to key and value
            comment = comment.split('=');

            // Empty fields are not disallowed, but we ignore them
            if (comment[0].length > 0) {
                // The field name is case-insensitive
                this.comments[comment[0].toLowerCase()] = comment[1];
            }
        }
    }

    /**
     * Decodes the setup header.
     *
     * @method decodeSetupHeader
     * @param {Ogg.Packet} packet
     */
    decodeSetupHeader(packet: Packet): void {
        // The header type
        const headerType = packet.get8(0);

        // Check the headerType and the theora signature
        if (headerType !== 0x82 && !isTheora(packet)) {
            throw new TheoraError('Invalid setup header.');
        }

        // Skip headerType and "theora" string (7 bytes)
        packet.seek(7);

        // Bitstream reader
        const reader = new Bitstream(packet, 7);

        /**
         * A 64-element array of loop filter limit values
         *
         * @property lflims
         * @type {Array}
         */
        this.lflims = decodeLFLTable(reader);

        this.decodeQuantizationParameters(reader);

        /**
         * An 80-element array of Huffman tables with up to 32 entries each.
         *
         * @property hts
         * @type {Array}
         */
        this.hts = decodeHuffmanTables(reader);
    }

    /**
     * Pre-computes all quantization matrices.
     *
     * @method computeQuantizationMatrices
     */
    computeQuantizationMatrices(): void {
        let qti;
        let pli;
        let qi;

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
                    this.qmats[qti][pli][qi] = this.computeQuantizationMatrix(qti, pli, qi);
                }
            }
        }
    }

    /**
     * Quantization Parameters Decode
     *
     * @method decodeQuantizationParameters
     * @private
     * @param {util.BitStream} reader
     */
    private decodeQuantizationParameters(reader: Bitstream): void {
        // A quantization type index
        let qti: number;

        // A quantization type index
        let qtj: number;

        // A color plane index
        let pli: number;

        // A color plane index
        let plj: number;

        // The quantization index
        let qi: number;

        // The base matrix index
        let bmi: number;

        // A base matrix index
        let bmj: number;

        // The quant range index
        let qri: number;

        // The size of fields to read
        let nbits: number;

        // Flag that indicates a new set of quant ranges will be defined
        let newqr: number;

        // Flag that indicates the quant ranges to copy
        let rpqr: number;

        // Get the acscale values
        nbits = reader.nextBits(4) + 1;
        for (qi = 0; qi < 64; qi += 1) {
            this.acScale[qi] = reader.nextUBits(nbits);
        }

        // Get the dcscale values
        nbits = reader.nextBits(4) + 1;
        for (qi = 0; qi < 64; qi += 1) {
            this.dcScale[qi] = reader.nextUBits(nbits);
        }

        // Get the number of base matrices
        this.nbms = reader.nextBits(9) + 1;
        if (this.nbms > 384) {
            throw new TheoraError('Number of base matrices is too high.');
        }

        // Get the base matrices
        for (bmi = 0; bmi < this.nbms; bmi += 1) {
            this.bms[bmi] = [];
            for (bmj = 0; bmj < 64; bmj += 1) {
                this.bms[bmi][bmj] = reader.nextBits(8);
            }
        }

        for (qti = 0; qti < 2; qti += 1) {
            this.qrsizes[qti] = [];
            this.qrbmis[qti] = [];

            for (pli = 0; pli < 3; pli += 1) {
                this.qrsizes[qti][pli] = [];
                this.qrbmis[qti][pli] = [];

                // Init qrsizes and qrbmis
                for (qri = 0; qri < 64; qri += 1) {
                    this.qrsizes[qti][pli][qri] = 0;
                    this.qrbmis[qti][pli][qri] = 0;
                }

                newqr = 1;
                if (qti > 0 || pli > 0) {
                    newqr = reader.nextBits(1);
                }

                if (newqr === 0) {
                    // Copying a previously defined set of quant ranges
                    rpqr = 0;
                    if (qti > 0) {
                        rpqr = reader.nextBits(1);
                    }

                    if (rpqr === 1) {
                        qtj = qti - 1;
                        plj = pli;
                    } else {
                        qtj = toInt((3 * qti + pli - 1) / 3);
                        plj = (pli + 2) % 3;
                    }

                    this.nqrs[qti][pli] = this.nqrs[qtj][plj];
                    this.qrsizes[qti][pli] = this.qrsizes[qtj][plj];
                    this.qrbmis[qti][pli] = this.qrbmis[qtj][plj];
                } else {
                    // Defining a new set of quant ranges
                    qri = 0;
                    qi = 0;

                    this.qrbmis[qti][pli][qri] = reader.nextBits(ilog(this.nbms - 1));
                    if (this.qrbmis[qti][pli][qri] >= this.nbms) {
                        throw new TheoraError('Stream is undecodeable.');
                    }

                    while (qi < 63) {
                        this.qrsizes[qti][pli][qri] = reader.nextBits(ilog(62 - qi)) + 1;
                        qi += this.qrsizes[qti][pli][qri];
                        qri += 1;
                        this.qrbmis[qti][pli][qri] = reader.nextBits(ilog(this.nbms - 1));
                    }

                    if (qi > 63) {
                        throw new TheoraError('Stream is undecodeable.');
                    }

                    this.nqrs[qti][pli] = qri;
                }
            }
        }
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
    private computeQuantizationMatrix(qti: number, pli: number, qi: number): number[] {
        // Quantization values for each DCT coefficient
        const qmat = [];

        // The quant range index
        let qri: number;

        // The left end-point of the qi range
        let qiStart = 0;

        // The right end-point of the qi range
        let qiEnd = 0;

        // Minimum quantization value allowed for the current coefficient
        let qmin;

        // Current scale value
        let qscale;

        // The DCT coefficient index
        let ci;

        // Current value of the interpolated base matrix
        let bm;

        // Find qri where qi is >= qiStart and qi <= qiEnd
        for (qri = 0; qri < 63; qri += 1) {
            qiEnd += this.qrsizes[qti][pli][qri];
            if (qi <= qiEnd && qiStart <= qi) {
                break;
            }

            qiStart = qiEnd;
        }

        // Base matrix index
        const bmi = this.qrbmis[qti][pli][qri];
        const bmj = this.qrbmis[qti][pli][qri + 1];

        for (ci = 0; ci < 64; ci += 1) {
            bm = toInt(
                (2 * (qiEnd - qi) * this.bms[bmi][ci] +
                    2 * (qi - qiStart) * this.bms[bmj][ci] +
                    this.qrsizes[qti][pli][qri]) /
                    (2 * this.qrsizes[qti][pli][qri])
            );

            qmin = 16;
            if (ci > 0 && qti === 0) {
                qmin = 8;
            } else if (ci === 0 && qti === 1) {
                qmin = 32;
            }

            if (ci === 0) {
                qscale = this.dcScale[qi];
            } else {
                qscale = this.acScale[qi];
            }

            qmat[ci] = Math.max(qmin, Math.min(toInt((qscale * bm) / 100) * 4, 4096));
        }

        return qmat;
    }
}
