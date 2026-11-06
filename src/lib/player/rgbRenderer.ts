import type { Frame } from '../theora/frame.ts';
import { convertLumaChromaToColor } from './color-conversion.ts';

const COLOR_CHANNELS = 3;
const ALPHA_CHANNELS = 4;
const ALPHA_OFFSET = 3;
const BLUE_OFFSET = 2;
const OPAQUE_ALPHA = 255;
const HALF_RESOLUTION = 2;
const HALF_VERTICAL_FORMAT = 0;
const HALF_HORIZONTAL_FORMAT = 2;

type RendererOptions = {
    readonly withAlphaChannel: boolean;
};

export type PictureSource = {
    readonly width: number;
    readonly height: number;
    readonly xOffset: number;
    readonly yOffset: number;
    readonly pixelFormat: number;
    readonly nextFrame: () => Frame | false;
};

type PictureLayout = {
    readonly width: number;
    readonly height: number;
    readonly xOffset: number;
    readonly yOffset: number;
    readonly horizontalDivisor: number;
    readonly verticalDivisor: number;
    readonly bytesPerPixel: number;
};

export type RGBRenderer = {
    readonly nextRGBFrame: () => Uint8Array<ArrayBuffer> | false;
};

function planeView(plane: Uint8Array): DataView {
    return new DataView(plane.buffer, plane.byteOffset, plane.byteLength);
}

type RenderingContext = {
    readonly layout: PictureLayout;
    readonly luma: DataView;
    readonly blueChroma: DataView;
    readonly redChroma: DataView;
    readonly lumaWidth: number;
    readonly chromaWidth: number;
    readonly target: DataView;
};

function renderPixel(context: RenderingContext, targetX: number, targetY: number): void {
    const row = context.layout.yOffset + context.layout.height - targetY - 1;
    const column = context.layout.xOffset + targetX;
    const chromaPosition = Math.trunc(row / context.layout.verticalDivisor) * context.chromaWidth +
        Math.trunc(column / context.layout.horizontalDivisor);
    const [ red, green, blue ] = convertLumaChromaToColor(
        context.luma.getUint8(row * context.lumaWidth + column),
        context.blueChroma.getUint8(chromaPosition),
        context.redChroma.getUint8(chromaPosition)
    );
    const position = (context.layout.width * targetY + targetX) * context.layout.bytesPerPixel;
    context.target.setUint8(position, red);
    context.target.setUint8(position + 1, green);
    context.target.setUint8(position + BLUE_OFFSET, blue);
    if (context.layout.bytesPerPixel === ALPHA_CHANNELS) {
        context.target.setUint8(position + ALPHA_OFFSET, OPAQUE_ALPHA);
    }
}

function renderPicture(layout: PictureLayout, frame: Frame, target: DataView): void {
    const context = {
        layout,
        target,
        luma: planeView(frame.lumaPlane),
        blueChroma: planeView(frame.blueChromaPlane),
        redChroma: planeView(frame.redChromaPlane),
        lumaWidth: frame.lumaWidth,
        chromaWidth: frame.chromaWidth
    };
    for (let row = 0; row < layout.height; row += 1) {
        for (let column = 0; column < layout.width; column += 1) {
            renderPixel(context, column, row);
        }
    }
}

export function createRGBRenderer(source: PictureSource, options: RendererOptions): RGBRenderer {
    const layout: PictureLayout = {
        width: source.width,
        height: source.height,
        xOffset: source.xOffset,
        yOffset: source.yOffset,
        horizontalDivisor: source.pixelFormat === HALF_VERTICAL_FORMAT || source.pixelFormat === HALF_HORIZONTAL_FORMAT
            ? HALF_RESOLUTION
            : 1,
        verticalDivisor: source.pixelFormat === HALF_VERTICAL_FORMAT ? HALF_RESOLUTION : 1,
        bytesPerPixel: options.withAlphaChannel ? ALPHA_CHANNELS : COLOR_CHANNELS
    };
    const buffer = new Uint8Array(layout.width * layout.height * layout.bytesPerPixel);
    const target = new DataView(buffer.buffer);

    function nextRGBFrame(): Uint8Array<ArrayBuffer> | false {
        const frame = source.nextFrame();
        if (frame === false) {
            return false;
        }
        renderPicture(layout, frame, target);
        return new Uint8Array(buffer);
    }

    return { nextRGBFrame };
}
