import test from 'ava';
import {
    computeBlockToSuperBlockTable,
    computeMacroBlockMappingTables,
    computeRasterToCodedOrderMappingTable,
    computeSuperBlockSizes
} from '../../../../src/lib/theora/mappingTables.ts';

test('keeps partial superblocks in plane raster order', function (t) {
    t.deepEqual(computeSuperBlockSizes(5, 3), [ 12, 3 ]);
    t.deepEqual(computeBlockToSuperBlockTable(5, 3, [ 12, 3 ], 7), [
        ...Array.from({ length: 12 }, function () {
            return 7;
        }),
        8,
        8,
        8
    ]);
});

test('maps a two by two tile in Hilbert order with a coded offset', function (t) {
    t.deepEqual(computeRasterToCodedOrderMappingTable(2, 2, 10), [ 10, 11, 13, 12 ]);
});

const macroblocks = [
    { format: 0, raster: [ 0, 3, 1, 2, 4, 5 ] },
    { format: 2, raster: [ 0, 3, 1, 2, 4, 5, 6, 7 ] },
    { format: 3, raster: [ 0, 3, 1, 2, 4, 7, 5, 6, 8, 11, 9, 10 ] }
];
for (const { format, raster } of macroblocks) {
    test(`groups luma and both chroma planes for pixel format ${format}`, function (t) {
        t.deepEqual(computeMacroBlockMappingTables(1, 1, format, raster), [
            raster.map(function () {
                return 0;
            }),
            [ raster ]
        ]);
    });
}
