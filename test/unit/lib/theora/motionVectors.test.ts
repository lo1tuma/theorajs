import test from 'ava';
import { type Packet, createPacket } from '../../../../src/lib/ogg/packet.ts';
import type { FrameMappings } from '../../../../src/lib/theora/frame-mappings.ts';
import { readMotionVectors } from '../../../../src/lib/theora/motion-vectors.ts';
import { createBitstream } from '../../../../src/lib/theora/packet-bits.ts';

type MotionVector = readonly [number, number];

function motionVectorPacket(vectors: readonly MotionVector[]): Packet {
    const bits = `1${
        vectors
            .map(function (vector) {
                return vector
                    .map(
                        function (component) {
                            return `${
                                Math
                                    .abs(component)
                                    .toString(2)
                                    .padStart(5, '0')
                            }${component < 0 ? 1 : 0}`;
                        }
                    )
                    .join('');
            })
            .join('')
    }`;
    const padded = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');
    const bytes = [];
    for (let offset = 0; offset < padded.length; offset += 8) {
        bytes.push(Number.parseInt(padded.slice(offset, offset + 8), 2));
    }

    const packet = createPacket();
    packet.addSegment(new Uint8Array(bytes));
    return packet;
}

function macroblockLayout(blockCount: number): FrameMappings {
    const blocks = Array.from({ length: blockCount }, function (_value, index) {
        return index;
    });
    return {
        blockToSuperblock() {
            return 0;
        },
        rasterToCodedOrder(index) {
            return index;
        },
        codedToRasterOrder(index) {
            return index;
        },
        blockToMacroblock() {
            return 0;
        },
        macroblockToBlocks() {
            return blocks;
        },
        superBlockSize() {
            return blockCount;
        }
    };
}

const cases: {
    readonly name: string;
    readonly luma: readonly MotionVector[];
    readonly chroma420: MotionVector;
    readonly chroma422: readonly MotionVector[];
}[] = [
    {
        name: 'negative half ties',
        luma: [ [ -1, 0 ], [ 0, -1 ], [ -1, 0 ], [ 0, -1 ] ],
        chroma420: [ -1, -1 ],
        chroma422: [ [ -1, -1 ], [ -1, -1 ] ]
    },
    {
        name: 'positive half ties',
        luma: [ [ 1, 0 ], [ 0, 1 ], [ 1, 0 ], [ 0, 1 ] ],
        chroma420: [ 1, 1 ],
        chroma422: [ [ 1, 1 ], [ 1, 1 ] ]
    },
    {
        name: 'negative quarter values',
        luma: [ [ -1, 0 ], [ 0, -1 ], [ 0, 0 ], [ 0, 0 ] ],
        chroma420: [ 0, 0 ],
        chroma422: [ [ -1, -1 ], [ 0, 0 ] ]
    },
    {
        name: 'positive quarter values',
        luma: [ [ 1, 0 ], [ 0, 1 ], [ 0, 0 ], [ 0, 0 ] ],
        chroma420: [ 0, 0 ],
        chroma422: [ [ 1, 1 ], [ 0, 0 ] ]
    },
    {
        name: 'zero',
        luma: [ [ 0, 0 ], [ 0, 0 ], [ 0, 0 ], [ 0, 0 ] ],
        chroma420: [ 0, 0 ],
        chroma422: [ [ 0, 0 ], [ 0, 0 ] ]
    },
    {
        name: 'frame 247 motion',
        luma: [ [ 31, -20 ], [ 8, 6 ], [ 28, -20 ], [ 4, 16 ] ],
        chroma420: [ 18, -5 ],
        chroma422: [ [ 20, -7 ], [ 16, -2 ] ]
    }
];

for (const pixelFormat of [ 0, 2, 3 ] as const) {
    for (const scenario of cases) {
        test(`decodes ${scenario.name} chroma motion in pixel format ${pixelFormat}`, function (t) {
            const blockCount = { 0: 6, 2: 8, 3: 12 }[pixelFormat];
            const tables = macroblockLayout(blockCount);
            const blocks = tables.macroblockToBlocks(0);
            const reader = createBitstream(motionVectorPacket(scenario.luma), 0);
            const parsed = readMotionVectors(reader, { pixelFormat, macroblockCount: 1, blockCount }, tables, {
                modes: [ 7 ],
                flags: blocks.map(function () {
                    return 1;
                })
            });
            const vectors = blocks.map(function (block) {
                return parsed.forBlock(block);
            });

            const expectedByFormat = {
                0: [ scenario.chroma420, scenario.chroma420 ],
                2: [ ...scenario.chroma422, ...scenario.chroma422 ],
                3: [ ...scenario.luma, ...scenario.luma ]
            };

            t.deepEqual(vectors.slice(0, 4), scenario.luma);
            t.deepEqual(vectors.slice(4), expectedByFormat[pixelFormat]);
        });
    }
}
