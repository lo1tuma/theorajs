import { OggError } from './errors.ts';
import type { Page } from './page.ts';
import type { TransportStream } from './transportStream.ts';

export type LogicalPageCursor = {
    readonly nextSegment: (checkForContinuation: boolean) => Uint8Array | false;
    readonly nextPage: () => boolean;
};

function readMatchingPage(stream: TransportStream, serialNumber: number): Page {
    let page = stream.nextPage();
    while (page.serialNumber !== serialNumber && !page.isEndOfStream()) {
        page = stream.nextPage();
    }
    return page;
}

export function createLogicalPageCursor(stream: TransportStream, firstPage: Page): LogicalPageCursor {
    if (!firstPage.isBeginOfStream()) {
        throw new OggError('LogicalStream must be initialized with a BeginOfStream page.', {});
    }
    let currentPage = firstPage;
    let segmentOffset = 0;
    let lastPageNumber = firstPage.pageSequenceNumber;

    function nextPage(): boolean {
        if (currentPage.isEndOfStream()) {
            return false;
        }
        const page = readMatchingPage(stream, firstPage.serialNumber);
        if (page.pageSequenceNumber - 1 !== lastPageNumber) {
            throw new OggError('Lost data; missing page.', {});
        }
        lastPageNumber = page.pageSequenceNumber;
        currentPage = page;
        return true;
    }

    return {
        nextPage,
        nextSegment(checkForContinuation: boolean): Uint8Array | false {
            if (segmentOffset >= currentPage.pageSegments) {
                if (!nextPage()) {
                    return false;
                }
                if (checkForContinuation && !currentPage.isContinuedPage()) {
                    throw new OggError('Page is not a continued page.', {});
                }
                segmentOffset = 0;
            }
            const segment = currentPage.segments[segmentOffset];
            segmentOffset += 1;
            return segment ?? false;
        }
    };
}
