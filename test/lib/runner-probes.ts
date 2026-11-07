import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RunResult } from '@overkill-dev/engine';

type ProbeResult = { readonly code: number; readonly result: RunResult; };
const root = path.resolve(import.meta.dirname, '../../..');

async function execute(args: readonly string[]): Promise<number> {
    return new Promise(function (resolve, reject) {
        execFile(path.join(root, 'node_modules/.bin/overkill'), args, {
            cwd: root,
            timeout: 60_000,
            maxBuffer: 131_072
        }, function (error) {
            if (error === null) {
                resolve(0);
            } else if (typeof error.code === 'number' && error.killed !== true) {
                resolve(error.code);
            } else {
                reject(new Error('Runner probe process failed.', { cause: error }));
            }
        });
    });
}

export async function createProbeDirectory(): Promise<string> {
    return mkdtemp(path.join(os.tmpdir(), 'runner-probe-'));
}

export async function runProbe(directory: string, title: string): Promise<ProbeResult> {
    const configuration = path.join(directory, 'overkill.config.mjs');
    const report = path.join(directory, 'result.json');
    const reporter = pathToFileURL(path.join(root, 'build/test/runner/report.js')).href;
    await writeFile(
        configuration,
        `
import { defineConfig } from ${JSON.stringify(import.meta.resolve('@overkill-dev/test/config'))};
import { reportToFile } from ${JSON.stringify(reporter)};
export const config = defineConfig({
    runtimeStateDir: 'target/.overkill',
    profiles: {
        probe: {
            testFamily: 'integration',
            timeouts: { collectionMilliseconds: 30_000 },
            files: { include: [ 'build/test/runner/lifecycle.js' ] },
            reporters: [ reportToFile(${JSON.stringify(report)}) ]
        }
    }
});
`
    );
    const code = await execute([ 'run', '--config', configuration, '--profile', 'probe', '--title', title ]);
    const result = JSON.parse(await readFile(report, 'utf8')) as RunResult;
    return { code, result };
}
