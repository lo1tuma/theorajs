import path from 'path';
import { forAllRGBAFrames, readOggFile, writePng } from '../lib/files';
import { Decoder } from '../../src/theora/decoder';

const mediumComplexOggFile = path.resolve(__dirname, '../fixtures/trailer_400p.ogg');

async function main(): Promise<void> {
    const byteStream = await readOggFile(mediumComplexOggFile);

    await forAllRGBAFrames(byteStream, async (frame: Uint8Array, decoder: Decoder, frameIndex: number) => {
        await writePng(`./test/reference-pictures/trailer_400p/frame_${frameIndex}.png`, frame, decoder);
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
