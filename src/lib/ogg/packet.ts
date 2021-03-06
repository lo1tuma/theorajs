export class Packet {
    public data: Uint8Array;

    private offset: number;

    /**
     * Represents a logical ogg packet.
     *
     * @class Packet
     * @namespace Ogg
     * @constructor
     */
    constructor() {
        this.data = new Uint8Array(0);
        this.offset = 0;
    }

    /**
     * Adds a segment.
     *
     * @method addSegment
     * @param {Array} segment Data array of the segment
     */
    addSegment(segment: Uint8Array): void {
        if (segment.length === 0) {
            // Don't add zero length segments
            return;
        }

        const result = new Uint8Array(this.data.length + segment.length);

        result.set(this.data, 0);
        result.set(segment, this.data.length);

        this.data = result;
    }

    /**
     * Get the length of the packet
     *
     * @method getLength
     * @return {Number}
     */
    getLength(): number {
        return this.data.length;
    }

    /**
     * Gets next 8-bit value.
     *
     * @method next8
     * @return {Number}
     */
    next8(): number {
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
    next16(): number {
        return (this.next8() << 8) | this.next8();
    }

    /**
     * Gets next 24-bit value.
     *
     * @method next24
     * @return {Number}
     */
    next24(): number {
        return (this.next8() << 16) | this.next16();
    }

    /**
     * Gets next 32-bit value.
     *
     * @method next32
     * @return {Number}
     */
    next32(): number {
        return (this.next8() << 24) | this.next24();
    }

    /**
     * Get a 8-bit value of a specified offset.
     *
     * @method get8
     * @param {Number} i offset
     * @return {Number}
     */
    get8(i: number): number {
        return this.data[i];
    }

    /**
     * Skips a specified number of bytes.
     *
     * @method skip
     * @param {Number} n Bytes to skip.
     */
    skip(n: number): void {
        this.offset += n;
    }

    /**
     * Seeks to a specified position.
     *
     * @method seek
     * @param {Number} pos Position
     */
    seek(pos: number): void {
        this.offset = pos;
    }
}
