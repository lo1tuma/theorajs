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

        for (let targetY = 0; targetY < this.decoder.height; targetY += 1) {
            const row = this.decoder.yOffset + this.decoder.height - targetY - 1;
            for (let targetX = 0; targetX < this.decoder.width; targetX += 1) {
                const column = this.decoder.xOffset + targetX;
                const subPlaneRow = (row / this.verticalPlaneDivisor) | 0;
                const subPlaneColumn = (column / this.horizontalPlaneDivisor) | 0;
                const pixel = yCbCrToRGB(
                    frame.recy[row * frame.rpyw + column],
                    frame.reccb[subPlaneRow * frame.rpcw + subPlaneColumn],
                    frame.reccr[subPlaneRow * frame.rpcw + subPlaneColumn]
                );

                const bufferIndex = (this.decoder.width * targetY + targetX) * this.bytesPerPixel;

                this.currentBuffer[bufferIndex] = pixel[0];
                this.currentBuffer[bufferIndex + 1] = pixel[1];
                this.currentBuffer[bufferIndex + 2] = pixel[2];

                if (this.options.withAlphaChannel) {
                    this.currentBuffer[bufferIndex + 3] = 255;
                }
            }
        }

        return new Uint8Array(this.currentBuffer);
    }
}
