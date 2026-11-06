export function shiftSignedLeft(value: number, distance: number): number {
    // eslint-disable-next-line no-bitwise -- Huffman codes and fixed-point coefficients require signed 32-bit shifts.
    return value << distance;
}

export function toSignedInteger(value: number): number {
    return shiftSignedLeft(value, 0);
}

export function shiftSignedRight(value: number, distance: number): number {
    // eslint-disable-next-line no-bitwise -- Fixed-point division must round negative values toward negative infinity.
    return value >> distance;
}

export function shiftUnsignedRight(value: number, distance: number): number {
    // eslint-disable-next-line no-bitwise -- Packet fields require zero-filled 32-bit shifts.
    return value >>> distance;
}

export function combineBits(left: number, right: number): number {
    // eslint-disable-next-line no-bitwise -- Assemble disjoint packet fields with signed 32-bit semantics.
    return left | right;
}

export function maskBits(value: number, mask: number): number {
    // eslint-disable-next-line no-bitwise -- Keep only the specified protocol bits.
    return value & mask;
}
