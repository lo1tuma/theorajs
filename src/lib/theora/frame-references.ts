import { REFERENCE_FRAME_INDICES } from './constants.ts';
import { TheoraError } from './errors.ts';

export const GOLDEN_REFERENCE = 2;
export type ReferenceIndex = typeof GOLDEN_REFERENCE | 0 | 1;

export function referenceForMode(mode: number | undefined): ReferenceIndex {
    if (mode === undefined) {
        throw new TheoraError('Missing macroblock mode.', {});
    }
    const reference = REFERENCE_FRAME_INDICES[mode];
    if (reference === 0 || reference === 1 || reference === GOLDEN_REFERENCE) {
        return reference;
    }
    throw new TheoraError('Invalid frame reference index.', {});
}
