import { writeFile } from 'node:fs/promises';
import { defineReporter } from '@overkill-dev/engine';

export function reportToFile(file: string): ReturnType<typeof defineReporter> {
    return defineReporter(function () {
        return {
            kind: 'final-result',
            name: 'runner verification',
            sinks: [ { kind: 'file', path: file } ],
            dispose: null,
            async onResult(result) {
                await writeFile(file, JSON.stringify(result));
            }
        };
    });
}
