import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const WIDTH = 720;
const HEIGHT = 400;
const FRAME_COUNT = 813;
const LUMA_SIZE = WIDTH * HEIGHT;
const CHROMA_DIVISOR = 4;
const CHROMA_SIZE = LUMA_SIZE / CHROMA_DIVISOR;
const CHROMA_PLANES = 2;
const FRAME_SIZE = LUMA_SIZE + CHROMA_PLANES * CHROMA_SIZE;
const REFERENCE_DIGEST = 'a221a2efaf04ad1a072f5ea0d927cfcd93091ac2f889ac4e5aaa94e1430d8951';
const CHANNEL_MAXIMUM = 255;
const LUMA_BLACK = 16;
const LUMA_RANGE = 219;
const CHROMA_CENTER = 128;
const CHROMA_RANGE = 224;
const HALF_RESOLUTION = 2;
const RGBA_CHANNELS = 4;
const BLUE_CHANNEL = 2;
const ALPHA_CHANNEL = 3;
const RED_SCALE = 1.402;
const GREEN_BLUE_SCALE = 0.344136286;
const GREEN_RED_SCALE = 0.714136286;
const BLUE_SCALE = 1.772;
const PNG_RGBA = 6;

function quantizeChannel(intensity: number): number {
    return Math.floor(CHANNEL_MAXIMUM * Math.min(1, Math.max(0, intensity)));
}

type ReferenceColor = { readonly luminance: number; readonly blueDifference: number; readonly redDifference: number; };

function readReferenceColor(reference: Buffer, start: number, column: number, row: number): ReferenceColor {
    const lumaIndex = row * WIDTH + column;
    const chromaIndex = Math.floor(row / HALF_RESOLUTION) * (WIDTH / HALF_RESOLUTION) +
        Math.floor(column / HALF_RESOLUTION);
    return {
        luminance: (reference.readUInt8(start + lumaIndex) - LUMA_BLACK) / LUMA_RANGE,
        blueDifference: (reference.readUInt8(start + LUMA_SIZE + chromaIndex) - CHROMA_CENTER) / CHROMA_RANGE,
        redDifference: (reference.readUInt8(start + LUMA_SIZE + CHROMA_SIZE + chromaIndex) - CHROMA_CENTER) /
            CHROMA_RANGE
    };
}

function writeReferencePixel(color: ReferenceColor, position: number, target: DataView): void {
    const { luminance, blueDifference, redDifference } = color;
    target.setUint8(position, quantizeChannel(luminance + RED_SCALE * redDifference));
    const green = luminance - GREEN_BLUE_SCALE * blueDifference - GREEN_RED_SCALE * redDifference;
    target.setUint8(position + 1, quantizeChannel(green));
    target.setUint8(position + BLUE_CHANNEL, quantizeChannel(luminance + BLUE_SCALE * blueDifference));
    target.setUint8(position + ALPHA_CHANNEL, CHANNEL_MAXIMUM);
}

function referenceToRGBA(reference: Buffer, frameIndex: number): Buffer {
    const rgba = Buffer.alloc(LUMA_SIZE * RGBA_CHANNELS);
    const target = new DataView(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    for (let row = 0; row < HEIGHT; row += 1) {
        for (let column = 0; column < WIDTH; column += 1) {
            const color = readReferenceColor(reference, frameIndex * FRAME_SIZE, column, row);
            writeReferencePixel(color, (row * WIDTH + column) * RGBA_CHANNELS, target);
        }
    }
    return rgba;
}

async function readReference(file: string): Promise<Buffer> {
    const reference = await readFile(file);
    const digest = createHash('sha256').update(reference).digest('hex');
    if (digest !== REFERENCE_DIGEST || reference.length !== FRAME_COUNT * FRAME_SIZE) {
        throw new Error('Reference must match the independently verified trailer planes.');
    }
    return reference;
}

async function writeReferenceImages(reference: Buffer, outputDirectory: string): Promise<void> {
    await mkdir(outputDirectory, { recursive: true });
    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
        const png = new PNG({ width: WIDTH, height: HEIGHT });
        png.data = referenceToRGBA(reference, frameIndex);
        const encoded = PNG.sync.write(png, { colorType: PNG_RGBA, inputColorType: PNG_RGBA, inputHasAlpha: true });
        await writeFile(path.join(outputDirectory, `frame_${frameIndex}.png`), encoded);
    }
}

async function main(): Promise<void> {
    const EXECUTABLE_ARGUMENTS = 2;
    const [ referenceFile, outputDirectory ] = process.argv.slice(EXECUTABLE_ARGUMENTS);
    const ARGUMENT_COUNT = 4;
    if (referenceFile === undefined || outputDirectory === undefined || process.argv.length !== ARGUMENT_COUNT) {
        throw new Error('Usage: node build/test/scripts/framesToImages.js reference.yuv output-directory');
    }
    await writeReferenceImages(await readReference(referenceFile), path.resolve(outputDirectory));
}

await main();
