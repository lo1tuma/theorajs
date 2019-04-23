import path from 'path';
import { forAllDecodedFrames, readOggFile, writePng } from '../lib/files';
import { Frame } from '../../src/theora/frame';
import { Decoder } from '../../src/theora/decoder';

const mediumComplexOggFile = path.resolve(__dirname, '../fixtures/trailer_400p.ogg');

async function main(): Promise<void> {
    const byteStream = await readOggFile(mediumComplexOggFile);
    let i = 0;

    await forAllDecodedFrames(byteStream, async (frame: Frame, decoder: Decoder) => {
        await writePng(`./test/reference-pictures/trailer_400p/frame_${i}.png`, frame, decoder);
        i += 1;
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
