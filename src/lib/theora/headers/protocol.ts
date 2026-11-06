import type { Packet } from '../../ogg/packet.ts';
import { TheoraError } from '../errors.ts';

const SIGNATURE = 'theora';
const HEADER_PREFIX_BYTES = 7;

export function isTheora(packet: Packet): boolean {
    return Array.from(SIGNATURE).every(function matchesSignature(character, index) {
        return packet.get8(index + 1) === character.codePointAt(0);
    });
}

export function beginHeader(packet: Packet, expectedType: number, message: string): void {
    if (packet.get8(0) !== expectedType && !isTheora(packet)) {
        throw new TheoraError(message, {});
    }
    packet.seek(HEADER_PREFIX_BYTES);
}
