import test from 'ava';
import { Frame } from '../../../../src/lib/theora/frame';
import { Header } from '../../../../src/lib/theora/header';
import { Packet } from '../../../../src/lib/ogg/packet';

type MotionVector = [number, number];

function motionVectorPacket(vectors: MotionVector[]): Packet {
    const bits = `1${vectors
        .map((vector) =>
            vector
                .map(
                    (component) =>
                        `${Math.abs(component)
                            .toString(2)
                            .padStart(5, '0')}${component < 0 ? 1 : 0}`
                )
                .join('')
        )
        .join('')}`;
    const padded = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');
    const bytes = [];
    for (let offset = 0; offset < padded.length; offset += 8) {
        bytes.push(parseInt(padded.slice(offset, offset + 8), 2));
    }

    const packet = new Packet();
    packet.addSegment(new Uint8Array(bytes));
    return packet;
}

const cases: {
    name: string;
    luma: MotionVector[];
    chroma420: MotionVector;
    chroma422: MotionVector[];
}[] = [
    {
        name: 'negative half ties',
        luma: [[-1, 0], [0, -1], [-1, 0], [0, -1]],
        chroma420: [-1, -1],
        chroma422: [[-1, -1], [-1, -1]]
    },
    {
        name: 'positive half ties',
        luma: [[1, 0], [0, 1], [1, 0], [0, 1]],
        chroma420: [1, 1],
        chroma422: [[1, 1], [1, 1]]
    },
    {
        name: 'negative quarter values',
        luma: [[-1, 0], [0, -1], [0, 0], [0, 0]],
        chroma420: [0, 0],
        chroma422: [[-1, -1], [0, 0]]
    },
    {
        name: 'positive quarter values',
        luma: [[1, 0], [0, 1], [0, 0], [0, 0]],
        chroma420: [0, 0],
        chroma422: [[1, 1], [0, 0]]
    },
    {
        name: 'zero',
        luma: [[0, 0], [0, 0], [0, 0], [0, 0]],
        chroma420: [0, 0],
        chroma422: [[0, 0], [0, 0]]
    },
    {
        name: 'frame 247 motion',
        luma: [[31, -20], [8, 6], [28, -20], [4, 16]],
        chroma420: [18, -5],
        chroma422: [[20, -7], [16, -2]]
    }
];

for (const pixelFormat of [0, 2, 3]) {
    for (const scenario of cases) {
        test(`decodes ${scenario.name} chroma motion in pixel format ${pixelFormat}`, (t) => {
            const header = Object.assign(new Header(), { pf: pixelFormat, nmbs: 1, fmbw: 1, fmbh: 1 });
            const blockCount = pixelFormat === 0 ? 6 : pixelFormat === 2 ? 8 : 12;
            const blocks = Array.from({ length: blockCount }, (_, index) => index);
            const tables = {
                biToSbi: [],
                rasterToCodedOrder: blocks,
                codedToRasterOrder: blocks,
                biToMbi: blocks.map(() => 0),
                mbiToBi: [blocks],
                superBlockSizes: []
            };
            const frame = new Frame(header, motionVectorPacket(scenario.luma), tables, [
                0,
                4,
                4 + (blockCount - 4) / 2
            ]);
            const vectors: MotionVector[] = [];
            Object.assign(frame, { mbmodes: [7], bcoded: blocks.map(() => 1), mvects: vectors });

            frame.decodeMacroBlockMotionVectors();

            let expected: MotionVector[];
            if (pixelFormat === 0) {
                expected = [scenario.chroma420, scenario.chroma420];
            } else if (pixelFormat === 2) {
                expected = [...scenario.chroma422, ...scenario.chroma422];
            } else {
                expected = [...scenario.luma, ...scenario.luma];
            }

            t.deepEqual(vectors.slice(0, 4), scenario.luma);
            t.deepEqual(vectors.slice(4), expected);
        });
    }
}
