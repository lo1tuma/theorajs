import test from 'ava';
import { limitFilterResponse } from '../../../../src/lib/theora/loop-filter.ts';

test('modulates the signed loop-filter response across both limit boundaries', function (t) {
    const responses = [ -9, -8, -7, -5, -4, -3, 0, 3, 4, 5, 7, 8, 9 ];
    const expected = [ 0, 0, -1, -3, -4, -3, 0, 3, 4, 3, 1, 0, 0 ];
    t.deepEqual(
        responses.map(function (response) {
            return limitFilterResponse(response, 4);
        }),
        expected
    );
    t.deepEqual(
        responses.map(function (response) {
            return limitFilterResponse(response, 0);
        }),
        responses.map(function () {
            return 0;
        })
    );
});
