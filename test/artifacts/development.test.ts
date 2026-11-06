import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import test from 'ava';
import ts from 'typescript';

type ExecutionOptions = { readonly cwd: string; };
type ExecutionResult = { readonly stdout: string; };

async function execute(command: string, args: readonly string[], options: ExecutionOptions): Promise<ExecutionResult> {
    return new Promise(function (resolve, reject) {
        execFile(command, args, { ...options, timeout: 60_000 }, function (error, stdout) {
            if (error === null) {
                resolve({ stdout });
            } else {
                reject(new Error('Artifact process failed.', { cause: error }));
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
    return directory;
}

test('decodes independent planes using only emitted artifacts', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    const result = await execute(process.execPath, [
        path.join(root, 'node_modules/ava/entrypoints/cli.js'),
        'test/integration/theora/reference.test.js'
    ], { cwd: directory });
    t.regex(result.stdout, /2 tests passed/u);
    await rm(path.join(directory, 'src/lib/theora/decoder.js'));
    await t.throwsAsync(
        execute(process.execPath, [ '--input-type=module', '-e', 'await import("./src/lib/theora/decoder.js")' ], {
            cwd: directory
        })
    );
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
