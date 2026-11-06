import type { ByteStream } from '../stream/byteStream.ts';
import { type LogicalStream, createLogicalStream } from './logicalStream.ts';

import { type Page, readPage } from './page.ts';

export type TransportStream = {
    readonly findLogicalStreams: () => readonly LogicalStream[];
    readonly nextPage: () => Page;
};

export function createTransportStream(byteStream: ByteStream): TransportStream {
    const logicalStreams: LogicalStream[] = [];

    function nextPage(): Page {
        return readPage(byteStream);
    }

    function findLogicalStreams(): readonly LogicalStream[] {
        let page = nextPage();
        while (page.isBeginOfStream()) {
            logicalStreams.push(createLogicalStream({ nextPage, findLogicalStreams }, page));
            page = nextPage();
        }
        byteStream.skip(-(page.headerLength + page.bodyLength));
        return logicalStreams;
    }

    return { findLogicalStreams, nextPage };
}
