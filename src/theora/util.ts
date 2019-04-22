import { Packet } from '../ogg/packet';
import { TheoraError } from './errors';

/**
 * Converts a YCbCr value to RGB.
 *
 * @method yCbCrToRGB
 * @param {Number} y
 * @param {Number} cb
 * @param {Number} cr
 * @return {Array} r, g, b
 */
export const yCbCrToRGB = (function() {
    const rgbCache: [number, number, number][][][] = [];
    const yOutCache: number[] = [];
    const pCache: number[] = [];

    // Init and pre-compute caches
    for (let i = 0; i < 256; i += 1) {
        rgbCache[i] = [];
        yOutCache[i] = (i - 16) / 219;
        pCache[i] = (i - 128) / 224;
        for (let j = 0; j < 256; j += 1) {
            rgbCache[i][j] = [];
        }
    }

    return function(y: number, cb: number, cr: number): [number, number, number] {
        const yOut = yOutCache[y];
        const pb = pCache[cb];
        const pr = pCache[cr];
        let r;
        let g;
        let b;

        // If we have no entry in the cache
        // we have to compute the r,g,b values
        if (!rgbCache[y][cb][cr]) {
            r = yOut + 1.402 * pr;
            g = yOut - 0.344136286 * pb - 0.714136286 * pr;
            b = yOut + 1.772 * pb;

            // Clamp
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
})();

/**
 * Extracts the sign of a Number
 *
 * @method sign
 * @param {Number} val
 * @return {Number} -1 or 1
 */
export function sign(val: number): -1 | 1 {
    return val < 0 ? -1 : 1;
}

/**
 * Converts any Number to Integer.
 *
 * @method toInt
 * @param {Number} val
 * @return {Number}
 */
export function toInt(val: number): number {
    return val | 0;
}

/**
 * Converts any Number to an unsigned Integer.
 *
 * @method toUInt
 * @param {Number} val
 * @return {Number}
 */
export function toUInt(val: number): number {
    return Math.abs(val | 0);
}

/**
 * Converts any Number to short (16-bit).
 *
 * @method toShort
 * @param {Number} val
 * @return {Number}
 */
export function toShort(val: number): number {
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
export function ilog(val: number): number {
    let ret = 0;

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
export function arrayFlip(a: number[]): number[] {
    let key;
    const b = [];

    for (key in a) {
        if (a.hasOwnProperty(key)) {
            b[a[key]] = Number(key);
        }
    }

    return b;
}

export class Bitstream {
    private packet: Packet;

    private bits: number;

    private lookup: number;

    private eos: boolean;

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
    constructor(packet: Packet, offset: number) {
        this.packet = packet;
        this.packet.seek(offset);

        // Number of bits already read
        this.bits = 0;

        // 16-bit lookup buffer
        this.lookup = packet.next16();

        // End of stream flag
        this.eos = false;
    }

    /**
     * Reads n bits.
     *
     * @method nextBits
     * @param {Number} n Number of bits, max 32 bits.
     * @return {Number}
     */
    nextBits(n: number): number {
        if (n === 0) {
            // Zero-bit integers will be handled as a '0' value
            return 0;
        }

        if (n <= 8) {
            return this.readBits(n);
        }

        if (n <= 16) {
            return (this.readBits(8) << (n - 8)) | this.readBits(n - 8);
        }

        if (n <= 24) {
            return (this.readBits(8) << (n - 16)) | (this.readBits(8) << (n - 8)) | this.readBits(n - 16);
        }

        if (n <= 32) {
            return (
                (this.readBits(8) << (n - 24)) |
                (this.readBits(8) << (n - 16)) |
                (this.readBits(8) << (n - 8)) |
                this.readBits(n - 24)
            );
        }

        throw new TheoraError('Bitstream can only read 0-32 bits at one time.');
    }

    /**
     * Reads n bits and returns an unsigned value.
     *
     * @method nextUBits
     * @param {Number} n Number of bits, max 32 bits.
     * @return {Number} unsigned
     */
    nextUBits(n: number): number {
        return Math.abs(this.nextBits(n));
    }

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
    readBits(n: number): number {
        // Number of bits to the next octet
        let trash;

        // Extract the data
        const val = this.lookup >>> (16 - n);

        // Check if we have 8 or more bits read,
        // if so shift lookup only to the next octet boundary and fetch new data
        if (this.bits + n >= 8 && !this.eos) {
            // Bits to the next octet boundary
            trash = 8 - this.bits;

            this.lookup <<= trash;

            // Try to get new data
            try {
                this.lookup |= this.packet.next8();
            } catch (error) {
                // No more new data exists, but there could be valid data in the lookup buffer
                this.eos = true;
            }

            // Shift remaing bits
            this.lookup <<= n - trash;
            this.bits = n - trash;
        } else {
            // Check if there are n bits available
            if (this.eos && n > 16 - this.bits) {
                throw new TheoraError('Bitstream: End of Stream');
            }

            this.lookup <<= n;
            this.bits += n;
        }

        // Set all bits above the 16th to zero,
        // this is necessary because js is a typeless language.
        // Bit operations are executed in a 32-bit context
        this.lookup &= 0xffff;

        return val;
    }
}
