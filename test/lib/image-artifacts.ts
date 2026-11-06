import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

type ImageSize = { readonly width: number; readonly height: number; };

export function frameToPng(frame: Uint8Array, dimensions: ImageSize): PNG {
    const png = new PNG({
        width: dimensions.width,
        height: dimensions.height,
        colorType: 2,
        inputColorType: 2,
        inputHasAlpha: false
    });
    png.data = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
    return png;
}

export async function writePng(file: string, frame: Uint8Array, dimensions: ImageSize): Promise<void> {
    await fileSystem.writeFile(path.resolve(file), PNG.sync.write(frameToPng(frame, dimensions)));
}

export async function savePngDiff(file: string, png: PNG): Promise<string> {
    const outputDirectory = path.resolve('build/test-output/integration');
    const output = path.resolve(outputDirectory, file);
    await fileSystem.mkdir(outputDirectory, { recursive: true });
    await fileSystem.writeFile(output, PNG.sync.write(png));
    return output;
}

export async function readPng(file: string): Promise<PNG> {
    return PNG.sync.read(await fileSystem.readFile(path.resolve(file)));
}
