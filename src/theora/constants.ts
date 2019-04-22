export const LONG_RUN_LENGTH_HUFFMAN_TABLE = [
    // Huffman codes
    [
        // 1 bit
        [{ rstart: 1, rbits: 0 }],

        // 2 bits
        [{ rstart: 2, rbits: 1 }],

        // 3 bits
        [{ rstart: 4, rbits: 1 }],

        // 4 bits
        [{ rstart: 6, rbits: 2 }],

        // 5 bits
        [{ rstart: 10, rbits: 3 }],

        // 6 bits
        [{ rstart: 18, rbits: 4 }, { rstart: 34, rbits: 12 }]
    ],

    // Offsets
    [0, 2, 6, 14, 30, 62]
];

export const SHORT_RUN_LENGTH_HUFFMAN_TABLE = [
    // Huffman codes
    [
        // 1 bit
        [{ rstart: 1, rbits: 1 }],

        // 2 bits
        [{ rstart: 3, rbits: 1 }],

        // 3 bits
        [{ rstart: 5, rbits: 1 }],

        // 4 bits
        [{ rstart: 7, rbits: 2 }],

        // 5 bits
        [{ rstart: 11, rbits: 2 }, { rstart: 15, rbits: 4 }]
    ],

    // Offsets
    [0, 2, 6, 14, 30]
];

export const MACRO_BLOCK_MODE_SCHEMES = [
    // No scheme for index 0
    null,

    // Scheme 1
    [3, 4, 2, 0, 1, 5, 6, 7],

    // Scheme 2
    [3, 4, 0, 2, 1, 5, 6, 7],

    // Scheme 3
    [3, 2, 4, 0, 1, 5, 6, 7],

    // Scheme 4
    [3, 2, 0, 4, 1, 5, 6, 7],

    // Scheme 5
    [0, 3, 4, 2, 1, 5, 6, 7],

    // Scheme 6
    [0, 5, 3, 4, 2, 1, 6, 7]
];

export const MACRO_BLOCK_MODE_SCHEMES_HUFFMAN_TABLE = [
    // Huffman codes
    [
        // 1 bits
        [0],

        // 2 bits
        [1],

        // 3 bits
        [2],

        // 4 bits
        [3],

        // 5 bits
        [4],

        // 6 bits
        [5],

        // 7 bits
        [6, 7]
    ],

    // Offsets
    [0, 2, 6, 14, 30, 62, 126, 254]
];

export const MOTION_VECTOR_COMPONENTS_HUFFMAN_TABLE = [
    // Huffman codes
    [
        // 1 bits
        [],

        // 2 bits
        [],

        // 3 bits
        [0, 1, -1],

        // 4 bits
        [2, -2, 3, -3],

        // 5 bits
        [],

        // 6 bits
        [4, -4, 5, -5, 6, -6, 7, -7],

        // 7 bits
        [8, -8, 9, -9, 10, -10, 11, -11, 12, -12, 13, -13, 14, -14, 15, -15],

        // 8 bits
        [
            16,
            -16,
            17,
            -17,
            18,
            -18,
            19,
            -19,
            20,
            -20,
            21,
            -21,
            22,
            -22,
            23,
            -23,
            24,
            -24,
            25,
            -25,
            26,
            -26,
            27,
            -27,
            28,
            -28,
            29,
            -29,
            30,
            -30,
            31,
            -31
        ]
    ],

    // Offsets
    [0, 0, 0, 6, 0, 40, 96, 224]
];

export const HUFFMAN_TABLE_GROUPS = [
    0,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4
];

// Reference frame index for each conding mode
export const REFERENCE_FRAME_INDICIES = [
    // INTER_NOMV mode => Previous frame reference
    1,

    // INTRA mode => no reference
    0,

    // INTER_MV mode => previous frame reference
    1,

    // INTER_MV_LAST mode => previous frame reference
    1,

    // INTER_MV_LAST2 mode => previous frame reference
    1,

    // INTER_GOLDEN_NOMV mode => golden frame reference
    2,

    // INTER_GOLDEN_MV mode => golden frame reference
    2,

    // INTER_MV_FOUR mode => previous frame reference
    1
];

export const DCPREDICTORS_WEIGHTS_AND_DIVISORS_TABLE = {
    1000: { weights: [1, 0, 0, 0], divisor: 1 },
    '0100': { weights: [0, 1, 0, 0], divisor: 1 },
    1100: { weights: [1, 0, 0, 0], divisor: 1 },
    '0010': { weights: [0, 0, 1, 0], divisor: 1 },
    1010: { weights: [1, 0, 1, 0], divisor: 2 },
    '0110': { weights: [0, 0, 1, 0], divisor: 1 },
    1110: { weights: [29, -26, 29, 0], divisor: 32 },
    '0001': { weights: [0, 0, 0, 1], divisor: 1 },
    1001: { weights: [75, 0, 0, 53], divisor: 128 },
    '0101': { weights: [0, 1, 0, 1], divisor: 2 },
    1101: { weights: [75, 0, 0, 53], divisor: 128 },
    '0011': { weights: [0, 0, 1, 0], divisor: 1 },
    1011: { weights: [75, 0, 0, 53], divisor: 128 },
    '0111': { weights: [0, 3, 10, 3], divisor: 16 },
    1111: { weights: [29, -26, 29, 0], divisor: 32 }
};

export const ZIG_ZAG_ORDER_MAPPING_TABLE = [
    [0, 1, 5, 6, 14, 15, 27, 28],
    [2, 4, 7, 13, 16, 26, 29, 42],
    [3, 8, 12, 17, 25, 30, 41, 43],
    [9, 11, 18, 24, 31, 40, 44, 53],
    [10, 19, 23, 32, 39, 45, 52, 54],
    [20, 22, 33, 38, 46, 51, 55, 60],
    [21, 34, 37, 47, 50, 56, 59, 61],
    [35, 36, 48, 49, 57, 58, 62, 63]
];

// Mapping table of the relative row position within a super block
export const ROW_MAPPING_TABLE = [
    [
        // 1*1
        [0],

        // 1*2
        [0, 1],

        // 1*3
        [0, 1, 2],

        // 1*4
        [0, 1, 2, 3]
    ],
    [
        // 2*1
        [0, 0],

        // 2*2
        [0, 0, 1, 1],

        // 2*3
        [0, 0, 1, 1, 2, 2],

        // 2*4
        [0, 0, 1, 1, 2, 3, 3, 2]
    ],
    [
        // 3*1
        [0, 0, 0],

        // 3*2
        [0, 0, 1, 1, 1, 0],

        // 3*3
        [0, 0, 1, 1, 2, 2, 2, 1, 0],

        // 3*4
        [0, 0, 1, 1, 2, 3, 3, 2, 2, 3, 1, 0]
    ],
    [
        // 4*1
        [0, 0, 0, 0],

        // 4*2
        [0, 0, 1, 1, 1, 1, 0, 0],

        // 4*3
        [0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0],

        // 4*4
        [0, 0, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 1, 1, 0, 0]
    ]
];

export const COLUMN_MAPPING_TABLE = [
    [
        // 1*1
        [0],

        // 1*2
        [0, 0],

        // 1*3
        [0, 0, 0],

        // 1*4
        [0, 0, 0, 0]
    ],
    [
        // 2*1
        [0, 1],

        // 2*2
        [0, 1, 1, 0],

        // 2*3
        [0, 1, 1, 0, 0, 1],

        // 2*4
        [0, 1, 1, 0, 0, 0, 1, 1]
    ],
    [
        // 3*1
        [0, 1, 2],

        // 3*2
        [0, 1, 1, 0, 2, 2],

        // 3*3
        [0, 1, 1, 0, 0, 1, 2, 2, 2],

        // 3*4
        [0, 1, 1, 0, 0, 0, 1, 1, 2, 2, 2, 2]
    ],
    [
        // 4*1
        [0, 1, 2, 3],

        // 4*2
        [0, 1, 1, 0, 3, 2, 2, 3],

        // 4*3
        [0, 1, 1, 0, 0, 1, 2, 3, 3, 2, 2, 3],

        // 4*4
        [0, 1, 1, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 2, 2, 3]
    ]
];

// Approximations of Sines and Cosines
export const COSINES: [64277, 60547, 54491, 46341, 36410, 25080, 12785];
export const SINES: [12785, 25080, 36410, 46341, 54491, 60547, 64277];

// Intra Predictor
export const INTRA_PREDICTOR = [
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128],
    [128, 128, 128, 128, 128, 128, 128, 128]
];
