import path from 'path';
import test from 'ava';
import { readOggFile } from '../../../lib/files';
import { TransportStream } from '../../../../src/lib/ogg/transportStream';
import { Decoder } from '../../../../src/lib/theora/decoder';

test('modulates the signed loop-filter response across both limit boundaries', async (t) => {
    const stream = await readOggFile(path.resolve(__dirname, '../../../fixtures/320x240.ogg'));
    const [logicalStream] = new TransportStream(stream).findLogicalStreams();
    const frame = new Decoder(logicalStream).nextFrame();
    if (!frame) {
        t.fail('Missing first frame');
        return;
    }

    const responses = [-9, -8, -7, -5, -4, -3, 0, 3, 4, 5, 7, 8, 9];
    const expected = [0, 0, -1, -3, -4, -3, 0, 3, 4, 3, 1, 0, 0];
    t.deepEqual(responses.map((response) => frame.getLflim(response, 4)), expected);
    t.deepEqual(responses.map((response) => frame.getLflim(response, 0)), responses.map(() => 0));
});
