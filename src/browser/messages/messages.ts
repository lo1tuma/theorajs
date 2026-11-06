export type DecoderMetadata = { readonly width: number; readonly height: number; readonly framerate: number; };
type PlaybackCommand = { readonly type: 'command'; readonly command: 'decode' | 'pause' | 'unknown'; };
type InitializeCommand = { readonly type: 'command'; readonly command: 'init'; readonly url: string; };
export type DecoderCommand = InitializeCommand | PlaybackCommand;
type FrameReply = { readonly type: 'data'; readonly frame: ArrayBuffer; };
type EndReply = { readonly type: 'eos'; };
type ErrorReply = { readonly type: 'error'; readonly message: string; };
type SuccessReply = { readonly type: 'success'; readonly data: DecoderMetadata; };
export type WorkerReply = EndReply | ErrorReply | FrameReply | SuccessReply;

type MessageRecord = Readonly<Record<string, unknown>>;

function isMessageRecord(value: unknown): value is MessageRecord {
    return typeof value === 'object' && value !== null;
}

function readCommandBody(data: MessageRecord): DecoderCommand {
    if (data.command === 'init' && typeof data.url === 'string') {
        return { type: 'command', command: 'init', url: data.url };
    }
    return data.command === 'decode' || data.command === 'pause'
        ? { type: 'command', command: data.command }
        : { type: 'command', command: 'unknown' };
}

export function readDecoderCommand(value: unknown): DecoderCommand | null {
    return isMessageRecord(value) && value.type === 'command' ? readCommandBody(value) : null;
}

function readMetadata(value: unknown): DecoderMetadata | null {
    if (!isMessageRecord(value)) {
        return null;
    }
    return typeof value.width === 'number' && typeof value.height === 'number' && typeof value.framerate === 'number'
        ? { width: value.width, height: value.height, framerate: value.framerate }
        : null;
}

function readSuccess(data: MessageRecord): WorkerReply | null {
    const metadata = readMetadata(data.data);
    return metadata === null ? null : { type: 'success', data: metadata };
}

function readFrame(data: MessageRecord): WorkerReply | null {
    return data.frame instanceof ArrayBuffer ? { type: 'data', frame: data.frame } : null;
}

function readFailure(data: MessageRecord): WorkerReply | null {
    return typeof data.message === 'string' ? { type: 'error', message: data.message } : null;
}

const replyReaders = new Map<string, (data: MessageRecord) => WorkerReply | null>([
    [ 'success', readSuccess ],
    [ 'data', readFrame ],
    [ 'eos', function () {
        return { type: 'eos' };
    } ],
    [ 'error', readFailure ]
]);

export function readWorkerReply(value: unknown): WorkerReply | null {
    return isMessageRecord(value) && typeof value.type === 'string'
        ? replyReaders.get(value.type)?.(value) ?? null
        : null;
}
