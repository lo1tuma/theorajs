export class ByteStream {
    private index: number;

    private length: number;

    private data: DataView;

    private byteView: Uint8Array;

    /**
     * ByteStream
     *
     * @class ByteStream
     * @namespace Stream
     * @param {String} data Binary data string
     * @constructor
     */
    constructor() {
        this.index = 0;
        this.length = 0;
        this.data = new DataView(new ArrayBuffer(0));
        this.byteView = new Uint8Array(0);
    }

    setData(buffer: ArrayBuffer): void {
        this.data = new DataView(buffer);
        this.byteView = new Uint8Array(buffer);
        this.length = this.data.byteLength;
    }

    /**
     * Get the next 8-bit value.
     *
     * @method next8
     * @return {Number}
     */
    next8(): number {
        const val = this.data.getUint8(this.index);

        this.index += 1;
        return val;
    }

    /**
     * Get the next 16-bit value.
     *
     * @method next16
     * @param {Boolean} [littleEndian=false] Defines the byte-order
     * @return {Number}
     */
    next16(littleEndian?: boolean): number {
        const val = this.data.getUint16(this.index, littleEndian);

        this.index += 2;
        return val;
    }

    /**
     * Get the next 24-bit value.
     *
     * @method next24
     * @param {Boolean} [littleEndian=false] Defines the byte-order
     * @return {Number}
     */
    next24(littleEndian?: boolean): number {
        const b1 = this.next8();
        const b2 = this.next8();
        const b3 = this.next8();

        if (littleEndian) {
            return (b3 << 16) | (b2 << 8) | b1;
        }

        return (b1 << 16) | (b2 << 8) | b3;
    }

    /**
     * Get the next 32-bit value.
     *
     * @method next32
     * @param {Boolean} [littleEndian=false] Defines the byte-order
     * @return {Number}
     */
    next32(littleEndian?: boolean): number {
        const val = this.data.getUint32(this.index, littleEndian);

        this.index += 4;
        return val;
    }

    /**
     * Get the next 64-bit value.
     * Javascript can't handle 64bit integers and all bit operations are performed with 32-bit arithmetic.
     * Therefore this method will return an object with 2 values, lowBits and highBits.
     *
     * @method next64
     * @param {Boolean} [littleEndian=false] Defines the byte-order
     * @return {Object}
     */
    next64(littleEndian?: boolean): number {
        const val = this.data.getFloat64(this.index, littleEndian);

        this.index += 8;

        return val;
    }

    /**
     * Generates a byte array of a specified number of values.
     * If there are not enough values left, the maximum of available values will be returned.
     *
     * @method nextArray
     * @param {Number} n Numer of values
     * @return {Array}
     */
    nextArray(n: number): Uint8Array {
        const bytes = this.byteView.subarray(this.index, this.index + n);

        this.index += n;

        return bytes;
    }

    /**
     * Skip a specified number of 8-bit values.
     *
     * @method skip
     * @param {Number} n Number of values.
     */
    skip(n: number): void {
        this.index += n;
    }
}
