import { combineBits, shiftSignedLeft } from '../stream/integer-arithmetic.ts';

const SHORT_BYTES = 2;
const INTEGER_BYTES = 4;
const SHORT_BITS = 16;

export type Packet = {
    readonly data: Uint8Array<ArrayBuffer>;
    readonly addSegment: (segment: Uint8Array) => void;
    readonly getLength: () => number;
    readonly next8: () => number;
    readonly next16: () => number;
    readonly next24: () => number;
    readonly next32: () => number;
    readonly get8: (position: number) => number;
    readonly skip: (length: number) => void;
    readonly seek: (position: number) => void;
};

export function createPacket(): Packet {
    let data = new Uint8Array(0);
    let view = new DataView(data.buffer);
    let position = 0;

    function next8(): number {
        const value = view.getUint8(position);
        position += 1;
        return value;
    }

    function next16(): number {
        const value = view.getUint16(position);
        position += SHORT_BYTES;
        return value;
    }

    return {
        get data() {
            return data;
        },
        addSegment(segment: Uint8Array): void {
            if (segment.length === 0) {
                return;
            }
            const result = new Uint8Array(data.length + segment.length);
            result.set(data);
            result.set(segment, data.length);
            data = result;
            view = new DataView(data.buffer);
        },
        getLength(): number {
            return data.length;
        },
        next8,
        next16,
        next24(): number {
            return combineBits(shiftSignedLeft(next8(), SHORT_BITS), next16());
        },
        next32(): number {
            const value = view.getUint32(position);
            position += INTEGER_BYTES;
            return value;
        },
        get8(offset: number): number {
            return view.getUint8(offset);
        },
        skip(length: number): void {
            position += length;
        },
        seek(offset: number): void {
            position = offset;
        }
    };
}
