import { createHash } from 'crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const width = 720;
const height = 400;
const frameCount = 813;
const lumaSize = width * height;
const chromaSize = lumaSize / 4;
const frameSize = lumaSize + 2 * chromaSize;
const referenceDigest = 'a221a2efaf04ad1a072f5ea0d927cfcd93091ac2f889ac4e5aaa94e1430d8951';

function quantizeChannel(intensity: number): number {
    return Math.floor(255 * Math.min(1, Math.max(0, intensity)));
}

function referenceToRGBA(reference: Buffer, frameIndex: number): Buffer {
    const rgba = Buffer.alloc(lumaSize * 4);
    const start = frameIndex * frameSize;
    for (let row = 0; row < height; row += 1) {
        for (let column = 0; column < width; column += 1) {
            const lumaIndex = row * width + column;
            const chromaIndex = Math.floor(row / 2) * (width / 2) + Math.floor(column / 2);
            const luminance = (reference[start + lumaIndex] - 16) / 219;
            const blueDifference = (reference[start + lumaSize + chromaIndex] - 128) / 224;
            const redDifference = (reference[start + lumaSize + chromaSize + chromaIndex] - 128) / 224;
            const target = lumaIndex * 4;
            rgba[target] = quantizeChannel(luminance + 1.402 * redDifference);
            rgba[target + 1] = quantizeChannel(luminance - 0.344136286 * blueDifference - 0.714136286 * redDifference);
            rgba[target + 2] = quantizeChannel(luminance + 1.772 * blueDifference);
            rgba[target + 3] = 255;
        }
    }

    return rgba;
}

function main(): void {
    if (process.argv.length !== 4) {
        throw new Error('Usage: node build/test/scripts/framesToImages.js reference.yuv output-directory');
    }

    const reference = readFileSync(process.argv[2]);
    const digest = createHash('sha256')
        .update(reference)
        .digest('hex');
    if (reference.length !== frameCount * frameSize || digest !== referenceDigest) {
        throw new Error('Reference must match the independently verified trailer planes.');
    }

    const outputDirectory = path.resolve(process.argv[3]);
    mkdirSync(outputDirectory, { recursive: true });
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const png = new PNG({ width, height });
        png.data = referenceToRGBA(reference, frameIndex);
        const encoded = PNG.sync.write(png, { colorType: 6, inputColorType: 6, inputHasAlpha: true });
        writeFileSync(path.join(outputDirectory, `frame_${frameIndex}.png`), encoded);
    }
}

try {
    main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
