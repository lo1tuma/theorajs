import { combineBits, shiftSignedLeft } from './integer-arithmetic.ts';

const SHORT_BYTES = 2;
const INTEGER_BYTES = 4;
const GRANULE_BYTES = 8;
const BYTE_BITS = 8;
const SHORT_BITS = 16;

export type Integer64 = {
    readonly lowBits: number;
    readonly highBits: number;
};

export type ByteStream = {
    readonly setData: (buffer: ArrayBuffer) => void;
    readonly next8: () => number;
    readonly next16: (littleEndian: boolean) => number;
    readonly next24: (littleEndian: boolean) => number;
    readonly next32: (littleEndian: boolean) => number;
    readonly next64: (littleEndian: boolean) => Integer64;
    readonly nextArray: (length: number) => Uint8Array<ArrayBuffer>;
    readonly skip: (length: number) => void;
};

export function createByteStream(): ByteStream {
    let position = 0;
    let data = new DataView(new ArrayBuffer(0));
    let bytes = new Uint8Array(0);

    function next8(): number {
        const value = data.getUint8(position);
        position += 1;
        return value;
    }

    return {
        setData(buffer: ArrayBuffer): void {
            data = new DataView(buffer);
            bytes = new Uint8Array(buffer);
        },
        next8,
        next16(littleEndian: boolean): number {
            const value = data.getUint16(position, littleEndian);
            position += SHORT_BYTES;
            return value;
        },
        next24(littleEndian: boolean): number {
            const first = next8();
            const second = next8();
            const third = next8();
            return littleEndian
                ? combineBits(
                    combineBits(shiftSignedLeft(third, SHORT_BITS), shiftSignedLeft(second, BYTE_BITS)),
                    first
                )
                : combineBits(
                    combineBits(shiftSignedLeft(first, SHORT_BITS), shiftSignedLeft(second, BYTE_BITS)),
                    third
                );
        },
        next32(littleEndian: boolean): number {
            const value = data.getUint32(position, littleEndian);
            position += INTEGER_BYTES;
            return value;
        },
        next64(littleEndian: boolean): Integer64 {
            const lowBits = data.getUint32(position + (littleEndian ? 0 : INTEGER_BYTES), littleEndian);
            const highBits = data.getInt32(position + (littleEndian ? INTEGER_BYTES : 0), littleEndian);
            position += GRANULE_BYTES;
            return { lowBits, highBits };
        },
        nextArray(length: number): Uint8Array<ArrayBuffer> {
            const result = bytes.subarray(position, position + length);
            position += length;
            return result;
        },
        skip(length: number): void {
            position += length;
        }
    };
}
