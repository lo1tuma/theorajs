import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import test from 'ava';
import ts from 'typescript';

type ExecutionOptions = { readonly cwd: string; };

async function execute(command: string, args: readonly string[], options: ExecutionOptions): Promise<void> {
    return new Promise(function (resolve, reject) {
        execFile(command, args, { ...options, timeout: 60_000 }, function (error, stdout, stderr) {
            if (error === null) {
                resolve();
            } else {
                reject(
                    new Error(`Artifact process failed with code ${String(error.code)}.\n${stdout}${stderr}`, {
                        cause: error
                    })
                );
            }
        });
    });
}
const root = path.resolve(import.meta.dirname, '../../..');

async function stageArtifacts(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'decoder-artifacts-'));
    await cp(path.join(root, 'build/src/lib'), path.join(directory, 'src/lib'), { recursive: true });
    await cp(path.join(root, 'build/test'), path.join(directory, 'test'), { recursive: true });
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await writeFile(
        path.join(directory, 'overkill.config.js'),
        `
import { defineConfig } from '@overkill-dev/test/config';
import { reportToFile } from './test/runner/report.js';
export const config = defineConfig({
    runtimeStateDir: 'target/.overkill',
    profiles: {
        reference: {
            testFamily: 'integration',
            timeouts: { collectionMilliseconds: 30_000 },
            files: { include: [ 'test/integration/theora/reference.test.js' ] },
            reporters: [ reportToFile('result.json') ]
        }
    }
});
`
    );
    return directory;
}

test.serial('decodes independent planes using only emitted artifacts', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    await execute(path.join(root, 'node_modules/.bin/overkill'), [
        'run',
        '--profile',
        'reference'
    ], { cwd: directory });
    const result: unknown = JSON.parse(await readFile(path.join(directory, 'result.json'), 'utf8'));
    t.like(result, { status: 'passed', summary: { planned: 2, passed: 2, failed: 0 }, runnerErrors: [] });
    await rm(path.join(directory, 'src/lib/theora/decoder.js'));
    await t.throwsAsync(
        execute(process.execPath, [ '--input-type=module', '-e', 'await import("./src/lib/theora/decoder.js")' ], {
            cwd: directory
        })
    );
});

test.serial('independent plane checks reject a corrupted expected byte', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    const reference = path.join(directory, 'test/fixtures/prediction.yuv');
    const expected = await readFile(reference);
    expected[0] = (expected.readUInt8(0) + 1) % 256;
    await writeFile(reference, expected);
    const failure = await t.throwsAsync(
        execute(path.join(root, 'node_modules/.bin/overkill'), [
            'run',
            '--profile',
            'reference'
        ], { cwd: directory }),
        { instanceOf: Error, message: /^Artifact process failed with code 1\./u }
    );
    const report = readFile(path.join(directory, 'result.json'), 'utf8');
    await t.notThrowsAsync(report, failure.message);
    t.like(JSON.parse(await report), {
        status: 'failed',
        summary: { planned: 2, passed: 1, failed: 1 },
        runnerErrors: []
    });
});

test('declarations work without original TypeScript sources', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    const consumer = path.join(directory, 'consumer.mts');
    await writeFile(
        consumer,
        'import { createDecoder } from "./src/lib/theora/decoder.js"; export const decode: typeof createDecoder = createDecoder;'
    );
    const program = ts.createProgram([ consumer ], {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        target: ts.ScriptTarget.ES2025,
        types: []
    });
    t.deepEqual(
        ts.getPreEmitDiagnostics(program).map(function (diagnostic) {
            return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        }),
        []
    );
});
