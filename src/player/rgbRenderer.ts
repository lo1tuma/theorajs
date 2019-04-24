import { yCbCrToRGB } from '../theora/util';
import { Decoder } from '../theora/decoder';

interface Options {
    withAlphaChannel: boolean;
}

export class RGBRenderer {
    private currentBuffer: Uint8Array;

    private decoder: Decoder;

    private horizontalPlaneDivisor: number;

    private verticalPlaneDivisor: number;

    private options: Options;

    private bytesPerPixel: number;

    constructor(decoder: Decoder, options: Options = { withAlphaChannel: false }) {
        this.decoder = decoder;
        this.options = options;

        this.bytesPerPixel = options.withAlphaChannel ? 4 : 3;
        this.currentBuffer = new Uint8Array(decoder.height * decoder.width * this.bytesPerPixel);

        if (decoder.pixelFormat === 0) {
            this.horizontalPlaneDivisor = 2;
            this.verticalPlaneDivisor = 2;
        } else if (decoder.pixelFormat === 2) {
            this.horizontalPlaneDivisor = 2;
            this.verticalPlaneDivisor = 1;
        } else {
            this.horizontalPlaneDivisor = 1;
            this.verticalPlaneDivisor = 1;
        }
    }

    public nextRGBFrame(): Uint8Array | false {
        const frame = this.decoder.nextFrame();

        if (!frame) {
            return false;
        }

        for (const changedPixel of frame.changedPixels) {
            const [column, row] = changedPixel;

            if (!this.isOutsideOfPictureRegion(column, row)) {
                const [targetX, targetY] = this.determineTargetCoordinate(column, row);
                const subPlaneRow = (row / this.verticalPlaneDivisor) | 0;
                const subPlaneColumn = (column / this.horizontalPlaneDivisor) | 0;
                const pixel = yCbCrToRGB(
                    frame.recy[row][column],
                    frame.reccb[subPlaneRow][subPlaneColumn],
                    frame.reccr[subPlaneRow][subPlaneColumn]
                );

                const bufferIndex = (this.decoder.width * targetY + targetX) * this.bytesPerPixel;

                this.currentBuffer[bufferIndex] = pixel[0];
                this.currentBuffer[bufferIndex + 1] = pixel[1];
                this.currentBuffer[bufferIndex + 2] = pixel[2];

                // TODO since the alpha value is always the same and we share the buffer between frames we can do this once in the constructor instead of every time, maybe we can even initialize all buffer values with 255
                if (this.options.withAlphaChannel) {
                    this.currentBuffer[bufferIndex + 3] = 255;
                }
            }
        }

        return new Uint8Array(this.currentBuffer);
    }

    private isOutsideOfPictureRegion(x: number, y: number): boolean {
        return x <= this.decoder.xOffset || y <= this.decoder.yOffset;
    }

    private determineTargetCoordinate(x: number, y: number): [number, number] {
        return [x - this.decoder.xOffset, this.decoder.height - (y - this.decoder.yOffset) - 1];
    }
}
