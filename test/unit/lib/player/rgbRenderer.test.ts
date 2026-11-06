import test, { type ExecutionContext } from 'ava';

import { createRGBRenderer, type PictureSource, type RGBRenderer } from '../../../../src/lib/player/rgbRenderer.ts';
import type { PixelCoordinate } from '../../../../src/lib/theora/frame-planes.ts';
import type { Frame } from '../../../../src/lib/theora/frame.ts';

const PLANE_EDGE = 6;
const HALF_EDGE = 3;
const PICTURE_EDGE = 2;
const GRAY_PICTURE = new Uint8Array([ 69, 69, 69, 255, 69, 69, 69, 255, 69, 69, 69, 255, 69, 69, 69, 255 ]);
const RED_PICTURE = new Uint8Array([ 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255 ]);
const WHITE_PICTURE = new Uint8Array([
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255
]);
const FILTERED_PICTURE = new Uint8Array([ 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255 ]);

type PictureFixture = {
    readonly frame: Frame;
    readonly source: PictureSource;
    readonly setChanges: (changes: readonly PixelCoordinate[]) => void;
    readonly finish: () => void;
};

function pictureFixture(pixelFormat: number, offset: number): PictureFixture {
    const chromaWidth = pixelFormat === HALF_EDGE ? PLANE_EDGE : HALF_EDGE;
    const chromaHeight = pixelFormat === 0 ? HALF_EDGE : PLANE_EDGE;
    let changes: readonly PixelCoordinate[] = Array.from(
        { length: PLANE_EDGE * PLANE_EDGE },
        function (_value, index) {
            return [ index % PLANE_EDGE, Math.trunc(index / PLANE_EDGE) ] as const;
        }
    );
    const frame: Frame = {
        frameType: 0,
        lumaWidth: PLANE_EDGE,
        lumaHeight: PLANE_EDGE,
        chromaWidth,
        chromaHeight,
        lumaPlane: Uint8Array.from({ length: PLANE_EDGE * PLANE_EDGE }, function () {
            return 235;
        }),
        blueChromaPlane: Uint8Array.from({ length: chromaWidth * chromaHeight }, function () {
            return 128;
        }),
        redChromaPlane: Uint8Array.from({ length: chromaWidth * chromaHeight }, function () {
            return 128;
        }),
        get changedPixels() {
            return changes;
        }
    };
    let active: Frame | false = frame;
    return {
        frame,
        source: {
            width: PICTURE_EDGE,
            height: PICTURE_EDGE,
            xOffset: offset,
            yOffset: offset,
            pixelFormat,
            nextFrame() {
                return active;
            }
        },
        setChanges(value: readonly PixelCoordinate[]): void {
            changes = value;
        },
        finish(): void {
            active = false;
        }
    };
}

function nextPicture(renderer: RGBRenderer): Uint8Array<ArrayBuffer> {
    const picture = renderer.nextRGBFrame();
    if (picture === false) {
        throw new Error('Missing rendered picture');
    }
    return picture;
}

function croppedPicture(withAlpha: boolean): Uint8Array {
    const white = withAlpha ? [ 255, 255, 255, 255 ] : [ 255, 255, 255 ];
    const black = withAlpha ? [ 0, 0, 0, 255 ] : [ 0, 0, 0 ];
    return new Uint8Array([ ...white, ...white, ...black, ...white ]);
}

function assertStableFrameCopies(
    t: ExecutionContext,
    fixture: PictureFixture,
    renderer: RGBRenderer,
    expected: Uint8Array
): void {
    const first = nextPicture(renderer);
    t.deepEqual(first, expected);
    fixture.setChanges([]);
    t.deepEqual(renderer.nextRGBFrame(), expected);
    first.fill(42);
    t.deepEqual(renderer.nextRGBFrame(), expected);
}

for (const pixelFormat of [ 0, 2, 3 ]) {
    for (const withAlphaChannel of [ false, true ]) {
        test(`renders cropped borders for format ${pixelFormat}, alpha=${withAlphaChannel}`, function (t) {
            const fixture = pictureFixture(pixelFormat, 2);
            fixture.frame.lumaPlane[2 * PLANE_EDGE + 2] = 16;
            const renderer = createRGBRenderer(fixture.source, { withAlphaChannel });
            assertStableFrameCopies(t, fixture, renderer, croppedPicture(withAlphaChannel));
            fixture.finish();
            t.false(renderer.nextRGBFrame());
        });
    }
}

test('renders chroma changes without reconstructed luma pixels', function (t) {
    const fixture = pictureFixture(0, 0);
    fixture.frame.lumaPlane.fill(76);
    const renderer = createRGBRenderer(fixture.source, { withAlphaChannel: true });
    const first = nextPicture(renderer);
    t.deepEqual(first, GRAY_PICTURE);
    fixture.frame.blueChromaPlane.fill(85);
    fixture.frame.redChromaPlane.fill(255);
    fixture.setChanges([]);
    t.deepEqual(renderer.nextRGBFrame(), RED_PICTURE);
    t.deepEqual(first, GRAY_PICTURE);
});

test('renders filtered pixels outside the reconstruction list', function (t) {
    const fixture = pictureFixture(0, 0);
    const renderer = createRGBRenderer(fixture.source, { withAlphaChannel: true });
    t.deepEqual(renderer.nextRGBFrame(), WHITE_PICTURE);
    fixture.frame.lumaPlane[PLANE_EDGE + 1] = 16;
    fixture.setChanges([ [ 0, 0 ] ]);
    t.deepEqual(renderer.nextRGBFrame(), FILTERED_PICTURE);
});
