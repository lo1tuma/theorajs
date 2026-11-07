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
const decoderConsumer = `
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createByteStream } from './src/lib/stream/byteStream.js';
import { createTransportStream } from './src/lib/ogg/transportStream.js';
import { createDecoder } from './src/lib/theora/decoder.js';
import { isTheora } from './src/lib/theora/headers/protocol.js';

const input = await readFile('prediction.ogv');
const bytes = createByteStream();
bytes.setData(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
const stream = createTransportStream(bytes).findLogicalStreams().find(function isVideoStream(candidate) {
    const packet = candidate.getFirstPacket();
    return packet !== false && isTheora(packet);
});
assert.ok(stream);
const decoder = createDecoder(stream);
assert.equal(decoder.width, 32);
assert.equal(decoder.height, 32);
assert.equal(decoder.pixelFormat, 0);
const expected = await readFile('prediction.yuv');
let offset = 0;
let frameCount = 0;
for (let frame = decoder.nextFrame(); frame !== false; frame = decoder.nextFrame()) {
    for (const [ plane, width, height ] of [
        [ frame.lumaPlane, 32, 32 ],
        [ frame.blueChromaPlane, 16, 16 ],
        [ frame.redChromaPlane, 16, 16 ]
    ]) {
        for (let row = height - 1; row >= 0; row -= 1) {
            const actual = plane.subarray(row * width, (row + 1) * width);
            assert.equal(Buffer.compare(actual, expected.subarray(offset, offset + width)), 0,
                'Decoded plane differs from independent reference');
            offset += width;
        }
    }
    frameCount += 1;
}
assert.equal(frameCount, 4);
assert.equal(offset, expected.length);
`;

async function stageArtifacts(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'decoder-artifacts-'));
    await cp(path.join(root, 'build/src/lib'), path.join(directory, 'src/lib'), { recursive: true });
    await Promise.all([ 'prediction.ogv', 'prediction.yuv' ].map(async function copyFixture(name) {
        return cp(path.join(root, 'build/test/fixtures', name), path.join(directory, name));
    }));
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await writeFile(path.join(directory, 'decoder-consumer.mjs'), decoderConsumer);
    return directory;
}

test.serial('decodes independent planes using only emitted artifacts', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    await execute(process.execPath, [ 'decoder-consumer.mjs' ], { cwd: directory });
    await rm(path.join(directory, 'src/lib/theora/decoder.js'));
    await t.throwsAsync(
        execute(process.execPath, [ 'decoder-consumer.mjs' ], { cwd: directory }),
        { message: /ERR_MODULE_NOT_FOUND/u }
    );
});

test.serial('independent plane checks reject a corrupted expected byte', async function (t) {
    const directory = await stageArtifacts();
    t.teardown(async function () {
        await rm(directory, { recursive: true, force: true });
    });
    const reference = path.join(directory, 'prediction.yuv');
    const expected = await readFile(reference);
    expected[0] = (expected.readUInt8(0) + 1) % 256;
    await writeFile(reference, expected);
    await t.throwsAsync(
        execute(process.execPath, [ 'decoder-consumer.mjs' ], { cwd: directory }),
        {
            instanceOf: Error,
            message:
                /^Artifact process failed with code 1\..*ERR_ASSERTION.*Decoded plane differs from independent reference/su
        }
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
