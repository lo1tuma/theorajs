import tables from './coding-tables.json' with { type: 'json' };

export type HuffmanRunLength = { readonly start: number; readonly extraBits: number; };
export type HuffmanTable<T> = { readonly codes: readonly (readonly T[])[]; readonly offsets: readonly number[]; };
export type PredictionWeights = {
    readonly weights: {
        readonly left: number;
        readonly lowerLeft: number;
        readonly lower: number;
        readonly lowerRight: number;
    };
    readonly divisor: number;
};
export const LONG_RUN_LENGTH_HUFFMAN_TABLE: HuffmanTable<HuffmanRunLength> = tables.LONG_RUN_LENGTH_HUFFMAN_TABLE;
export const SHORT_RUN_LENGTH_HUFFMAN_TABLE: HuffmanTable<HuffmanRunLength> = tables.SHORT_RUN_LENGTH_HUFFMAN_TABLE;
export const { MACRO_BLOCK_MODE_SCHEMES } = tables;
export const MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE: HuffmanTable<number> =
    tables.MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE;
export const MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE: HuffmanTable<number> =
    tables.MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE;
export const { HUFFMAN_TABLE_GROUPS } = tables;
export const DIRECT_PREDICTION_WEIGHTS: Readonly<Record<string, PredictionWeights>> = tables.DIRECT_PREDICTION_WEIGHTS;
export const { ZIG_ZAG_ORDER_MAPPING_TABLE } = tables;
export const { ROW_MAPPING_TABLE } = tables;
export const { COLUMN_MAPPING_TABLE } = tables;
export const { COSINES } = tables;
export const { SINES } = tables;
export const { INTRA_PREDICTOR } = tables;
export const { REFERENCE_FRAME_INDICES } = tables;
