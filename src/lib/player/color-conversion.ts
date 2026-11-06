const LUMA_BLACK = 16;
const LUMA_RANGE = 219;
const CHROMA_CENTER = 128;
const CHROMA_RANGE = 224;
const CHANNEL_MAXIMUM = 255;
const RED_CHROMA_WEIGHT = 1.402;
const GREEN_BLUE_CHROMA_WEIGHT = 0.344136286;
const GREEN_RED_CHROMA_WEIGHT = 0.714136286;
const BLUE_CHROMA_WEIGHT = 1.772;

type Color = readonly [red: number, green: number, blue: number];

const colorCache = new Map<string, Color>();

function toChannel(value: number): number {
    return Math.trunc(Math.min(1, Math.max(0, value)) * CHANNEL_MAXIMUM);
}

export function convertLumaChromaToColor(luma: number, blueChroma: number, redChroma: number): Color {
    const key = `${luma}/${blueChroma}/${redChroma}`;
    const cached = colorCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const brightness = (luma - LUMA_BLACK) / LUMA_RANGE;
    const blueDifference = (blueChroma - CHROMA_CENTER) / CHROMA_RANGE;
    const redDifference = (redChroma - CHROMA_CENTER) / CHROMA_RANGE;
    const color: Color = [
        toChannel(brightness + RED_CHROMA_WEIGHT * redDifference),
        toChannel(brightness - GREEN_BLUE_CHROMA_WEIGHT * blueDifference - GREEN_RED_CHROMA_WEIGHT * redDifference),
        toChannel(brightness + BLUE_CHROMA_WEIGHT * blueDifference)
    ];
    colorCache.set(key, color);
    return color;
}
