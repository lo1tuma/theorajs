import type { Packet } from '../../ogg/packet.ts';
import { beginHeader } from './protocol.ts';

const COMMENT_PARTS = 2;
const COMMENT_HEADER_TYPE = 0x81;

type Comments = Readonly<Record<string, string | undefined>>;

export type CommentHeader = {
    readonly vendor: string;
    readonly comments: Comments;
};

function readLength(packet: Packet): number {
    const bytes = new Uint8Array([ packet.next8(), packet.next8(), packet.next8(), packet.next8() ]);
    const view = new DataView(bytes.buffer);
    return view.getInt32(0, true);
}

function readText(packet: Packet): string {
    const length = readLength(packet);
    let text = '';
    for (let position = 0; position < length; position += 1) {
        text += String.fromCodePoint(packet.next8());
    }
    return text;
}

function readComments(packet: Packet): Comments {
    const count = readLength(packet);
    const comments: Record<string, string | undefined> = {};
    for (let index = 0; index < count; index += 1) {
        const [ name, value ] = readText(packet).split('=', COMMENT_PARTS);
        if (name !== undefined && name.length > 0) {
            comments[name.toLowerCase()] = value;
        }
    }
    return comments;
}

export function readCommentHeader(packet: Packet): CommentHeader {
    beginHeader(packet, COMMENT_HEADER_TYPE, 'Invalid comment header.');
    return { vendor: readText(packet), comments: readComments(packet) };
}
