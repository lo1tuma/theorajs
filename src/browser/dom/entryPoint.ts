import { startPlayer } from './player.ts';

const MILLISECONDS_PER_SECOND = 1000;

type PlaybackStatistics = { readonly elapsed: number; readonly frames: number; readonly framerate: number; };

function showStatistics(statistics: PlaybackStatistics): void {
    const element = document.querySelector('#info');
    if (element === null) {
        return;
    }
    const lines = [
        `Elapsed time: ${statistics.elapsed}s`,
        `average framerate: ${statistics.frames / statistics.elapsed}`,
        `video framerate: ${statistics.framerate}`,
        `total frames: ${statistics.frames}`
    ];
    element.replaceChildren(...lines.flatMap(function (line, index) {
        return index === 0
            ? [ document.createTextNode(line) ]
            : [ document.createElement('br'), document.createTextNode(line) ];
    }));
}

function startDemo(url: string, workerPath: string): void {
    let started = 0;
    startPlayer({
        url,
        elementId: 'test',
        workerPath,
        onStart(): void {
            started = Date.now();
        },
        onStop(frameCount: number, framerate: number): void {
            showStatistics({
                elapsed: (Date.now() - started) / MILLISECONDS_PER_SECOND,
                frames: frameCount,
                framerate
            });
        },
        onError(message: string): void {
            const element = document.querySelector('#info');
            if (element !== null) {
                element.textContent = message;
            }
        }
    });
}

const script = document.currentScript;
if (script instanceof HTMLScriptElement) {
    const { videoUrl, workerUrl } = script.dataset;
    if (videoUrl !== undefined && workerUrl !== undefined) {
        startDemo(videoUrl, workerUrl);
    }
}
