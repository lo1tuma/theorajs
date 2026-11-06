import test from 'ava';
import { createPacket } from '../../../../src/lib/ogg/packet.ts';
import { readCoefficients } from '../../../../src/lib/theora/coefficient-decoding.ts';
import { createBitstream } from '../../../../src/lib/theora/packet-bits.ts';

test('rejects a zero run that crosses the coefficient block boundary', function (t) {
    const packet = createPacket();
    packet.addSegment(new Uint8Array([ 0, 248, 3, 128 ]));
    const symbols = [ 8, 7 ].values();
    const header = {
        blockCount: 1,
        lumaBlockCount: 1,
        readCoefficientSymbol(): number {
            const symbol = symbols.next();
            if (symbol.done === true) {
                throw new Error('Unexpected coefficient symbol request');
            }
            return symbol.value;
        }
    };

    t.throws(function () {
        return readCoefficients(createBitstream(packet, 0), header, [ 0 ]);
    }, {
        message: 'Coefficient run exceeds block.'
    });
});
