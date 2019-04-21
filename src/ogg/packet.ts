export class Packet {
    private data: ReadonlyArray<number>;

    private offset: number;

    /**
     * Represents a logical ogg packet.
     *
     * @class Packet
     * @namespace Ogg
     * @constructor
     */
    constructor() {
        this.data = [];
        this.offset = 0;
    }

    /**
     * Adds a segment.
     *
     * @method addSegment
     * @param {Array} segment Data array of the segment
     */
    addSegment(segment: ReadonlyArray<number>) {
        if (segment.length === 0) {
            // Don't add zero length segments
            return;
        }

        this.data = this.data.concat(segment);
    }

    /**
     * Get the length of the packet
     *
     * @method getLength
     * @return {Number}
     */
    getLength() {
        return this.data.length;
    }

    /**
     * Gets next 8-bit value.
     *
     * @method next8
     * @return {Number}
     */
    next8() {
        const val = this.get8(this.offset);
        this.offset += 1;
        return val;
    }

    /**
     * Gets next 16-bit value.
     *
     * @method next16
     * @return {Number}
     */
    next16() {
        return (this.next8() << 8) | this.next8();
    }

    /**
     * Gets next 24-bit value.
     *
     * @method next24
     * @return {Number}
     */
    next24() {
        return (this.next8() << 16) | this.next16();
    }

    /**
     * Gets next 32-bit value.
     *
     * @method next32
     * @return {Number}
     */
    next32() {
        return (this.next8() << 24) | this.next24();
    }

    /**
     * Get a 8-bit value of a specified offset.
     *
     * @method get8
     * @param {Number} i offset
     * @return {Number}
     */
    get8(i: number) {
        return this.data[i];
    }

    /**
     * Skips a specified number of bytes.
     *
     * @method skip
     * @param {Number} n Bytes to skip.
     */
    skip(n: number) {
        this.offset += n;
    }

    /**
     * Seeks to a specified position.
     *
     * @method seek
     * @param {Number} pos Position
     */
    seek(pos: number) {
        this.offset = pos;
    }
}
