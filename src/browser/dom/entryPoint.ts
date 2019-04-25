import { Player } from './player';

declare global {
    interface Window {
        initPlayer: (url: string, workerPath: string) => void;
    }
}

window.initPlayer = function(url: string, workerPath: string): void {
    let startTime = 0;
    let stopTime = 0;

    function startClb(): void {
        const date = new Date();
        startTime = date.getTime();
    }

    function stopClb(frameCnt: number, framerate: number): void {
        const date = new Date();
        stopTime = date.getTime();

        const infoElement = document.querySelector('#info');

        if (infoElement) {
            const elapsedTime = (stopTime - startTime) / 1000;
            const avgFramerate = frameCnt / elapsedTime;

            infoElement.innerHTML = [
                `Elapsed time: ${elapsedTime}s`,
                `average framerate: ${avgFramerate}`,
                `video framerate: ${framerate}`,
                `total frames: ${frameCnt}`
            ].join('<br>');
        }
    }

    // eslint-disable-next-line no-new
    new Player(url, 'test', workerPath, startClb, stopClb);
};
