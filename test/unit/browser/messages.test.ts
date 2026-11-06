import test from 'ava';
import { readDecoderCommand, readWorkerReply } from '../../../src/browser/messages/messages.ts';

test('reads initialization and playback commands', function (t) {
    t.deepEqual(readDecoderCommand({ type: 'command', command: 'init', url: 'fixture.ogg' }), {
        type: 'command',
        command: 'init',
        url: 'fixture.ogg'
    });
    t.deepEqual(readDecoderCommand({ type: 'command', command: 'pause' }), { type: 'command', command: 'pause' });
    t.deepEqual(readDecoderCommand({ type: 'command', command: 'decode' }), { type: 'command', command: 'decode' });
});

test('ignores unrelated payloads and identifies invalid commands', function (t) {
    t.is(readDecoderCommand(null), null);
    t.is(readDecoderCommand({ type: 'unrelated', command: 'decode' }), null);
    t.deepEqual(readDecoderCommand({ type: 'command', command: 'init', url: 42 }), {
        type: 'command',
        command: 'unknown'
    });
});

test('reads frame buffers and decoder metadata', function (t) {
    const frame = new ArrayBuffer(16);
    const metadata = { width: 2, height: 2, framerate: 25 };
    t.deepEqual(readWorkerReply({ type: 'data', frame }), { type: 'data', frame });
    t.deepEqual(readWorkerReply({ type: 'success', data: metadata }), { type: 'success', data: metadata });
    t.deepEqual(readWorkerReply({ type: 'eos' }), { type: 'eos' });
    t.deepEqual(readWorkerReply({ type: 'error', message: 'Invalid input' }), {
        type: 'error',
        message: 'Invalid input'
    });
});

test('rejects malformed replies and inherited property names', function (t) {
    t.is(readWorkerReply({ type: 'success', data: { width: 2, height: '2', framerate: 25 } }), null);
    t.is(readWorkerReply({ type: 'data', frame: new Uint8Array(16) }), null);
    t.is(readWorkerReply({ type: 'error', message: 42 }), null);
    t.is(readWorkerReply({ type: 'constructor' }), null);
    t.is(readWorkerReply({ type: 'toString' }), null);
});
