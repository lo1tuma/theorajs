import { invertDirectPrediction, type PredictionCoding } from './direct-prediction.ts';
import {
    type Coefficients,
    type CoefficientStorage,
    BLOCK_COEFFICIENTS,
    createCoefficientStorage
} from './coefficient-storage.ts';

import { readCoefficientRun, readEndRun } from './coefficient-tokens.ts';
import { HUFFMAN_TABLE_GROUPS } from './constants.ts';
import type { Header } from './header.ts';
import type { Bitstream } from './packet-bits.ts';

const SELECTOR_BITS = 4;
const TABLES_PER_GROUP = 16;
const FIRST_VALUE_TOKEN = 7;
const GROUP_BYTES = new Uint8Array(HUFFMAN_TABLE_GROUPS);
const GROUPS = new DataView(GROUP_BYTES.buffer);

type CoefficientHeader = Pick<Header, 'blockCount' | 'lumaBlockCount' | 'readCoefficientSymbol'>;
type LevelReader = {
    readonly coefficients: Coefficients;
    readonly read: (level: number, active: ReadonlySet<number>) => readonly number[];
};

function completedPrefix(storage: CoefficientStorage, count: number): number {
    let block = 0;
    while (block < count && storage.position(block) >= BLOCK_COEFFICIENTS) {
        block += 1;
    }
    return block;
}

function createLevelReader(reader: Bitstream, header: CoefficientHeader, coded: readonly number[]): LevelReader {
    const storage = createCoefficientStorage(header.blockCount);
    let remainingEnds = 0;
    let lumaSelector = 0;
    let chromaSelector = 0;

    function readToken(block: number, level: number): void {
        const selector = block < header.lumaBlockCount ? lumaSelector : chromaSelector;
        const table = TABLES_PER_GROUP * GROUPS.getUint8(level) + selector;
        const token = header.readCoefficientSymbol(table, reader);
        if (token < FIRST_VALUE_TOKEN) {
            remainingEnds = readEndRun(reader, token, function () {
                return completedPrefix(storage, coded.length);
            }) - 1;
            storage.finish(block);
        } else {
            storage.apply(block, readCoefficientRun(reader, token));
        }
    }

    function readBlock(block: number, level: number): void {
        if (storage.position(block) !== level) {
            return;
        }
        storage.recordPosition(block);
        if (remainingEnds > 0) {
            storage.finish(block);
            remainingEnds -= 1;
        } else {
            readToken(block, level);
        }
    }

    return {
        coefficients: storage.coefficients,
        read(level: number, active: ReadonlySet<number>): readonly number[] {
            if (level === 0 || level === 1) {
                lumaSelector = reader.nextBits(SELECTOR_BITS);
                chromaSelector = reader.nextBits(SELECTOR_BITS);
            }
            const completed: number[] = [];
            for (const block of active) {
                readBlock(block, level);
                if (storage.position(block) === BLOCK_COEFFICIENTS) {
                    completed.push(block);
                }
            }
            return completed;
        }
    };
}

export function readCoefficients(reader: Bitstream, header: CoefficientHeader, coded: readonly number[]): Coefficients {
    const levels = createLevelReader(reader, header, coded);
    const active = new Set(coded);
    for (let level = 0; level < BLOCK_COEFFICIENTS; level += 1) {
        for (const block of levels.read(level, active)) {
            active.delete(block);
        }
    }
    return levels.coefficients;
}

type FrameCoefficientCoding = PredictionCoding & { readonly header: Header; };

export function readPredictedCoefficients(
    reader: Bitstream,
    coding: FrameCoefficientCoding,
    coded: readonly number[]
): Coefficients {
    const coefficients = readCoefficients(reader, coding.header, coded);
    invertDirectPrediction(coefficients, coding);
    return coefficients;
}
