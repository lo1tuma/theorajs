import { Packet } from './packet';
import { TransportStream } from './transportStream';
import { Page } from './page';
import { OggError } from './errors';

export class LogicalStream {
    public serialNumber: number;

    private stream: TransportStream;

    private currentPage: Page;

    private segmentOffset: number;

    private lastPageNumber: number;

    private firstPacket?: false | Packet;

    private rereadFirstPacket: boolean;

    /**
     * The logical stream is a specific demultiplexed stream of an ogg container.
     *
     * @class LogicalStream
     * @namespace Ogg
     * @constructor
     * @param {Ogg.TransportStream} transportStream
     * @param {Ogg.Page} firstPage
     */
    constructor(transportStream: TransportStream, firstPage: Page) {
        if (!firstPage.isBeginOfStream()) {
            throw new OggError('LogicalStream must be initialized with a BeginOfStream page.');
        }

        this.stream = transportStream;

        /**
         * Serial number of the logical stream
         *
         * @property serialNumber
         * @type Number
         */
        this.serialNumber = firstPage.serialNumber;

        // Page counter for the last page
        this.lastPageNumber = firstPage.pageSequenceNumber;

        this.currentPage = firstPage;
        this.segmentOffset = 0;

        this.rereadFirstPacket = false;
    }

    getFirstPacket(): false | Packet {
        if (this.firstPacket === undefined) {
            this.firstPacket = this.nextPacket();
            this.rereadFirstPacket = true;
        }

        return this.firstPacket;
    }

    /**
     * Gets the next packet.
     *
     * @method nextPacket
     * @return {Ogg.Packet}
     */
    nextPacket(): false | Packet {
        if (this.rereadFirstPacket && this.firstPacket !== undefined) {
            this.rereadFirstPacket = false;
            return this.firstPacket;
        }

        const packet = new Packet();

        let segment = this.nextSegment();
        if (!segment) {
            return false;
        }

        // Add segments to the current packet
        // a segment length < 255 means it is the last segment of the current packet
        while (segment.length === 255) {
            packet.addSegment(segment);
            segment = this.nextSegment(true);
            if (!segment) {
                throw new OggError('Missing EndOfPacket segment');
            }
        }

        // Add last segment
        packet.addSegment(segment);

        if (this.firstPacket === undefined) {
            this.firstPacket = packet;
        }

        return packet;
    }

    /**
     * Gets the next segment
     *
     * @method nextSegment
     * @private
     * @param {Boolean} [checkForContinuation=false] If true, check if continuation bit flag is
     *	set to the page, in case of a page spanning packet.
     * @return {Array}
     */
    nextSegment(checkForContinuation?: boolean): false | Uint8Array {
        let ret;

        // Check for pagebreak
        if (this.segmentOffset >= this.currentPage.pageSegments) {
            // Continue reading on next page
            ret = this.nextPage();
            if (!ret) {
                // End of stream and end of packet reached
                return false;
            }

            if (checkForContinuation) {
                // Check for continuation bit flag
                if (!this.currentPage.isContinuedPage()) {
                    throw new OggError('Page is not a continued page.');
                }
            }

            this.segmentOffset = 0;
        }

        const segment = this.currentPage.segments[this.segmentOffset];
        this.segmentOffset += 1;

        return segment;
    }

    /**
     * Gets next page within the logical stream.
     *
     * @method nextPage
     * @private
     * @return {Ogg.Page}
     */
    nextPage(): boolean {
        let page;

        if (this.currentPage.isEndOfStream()) {
            return false;
        }

        // Reading pages until we will find a page which belongs to this logical stream
        do {
            page = this.stream.nextPage();
        } while (page.serialNumber !== this.serialNumber && !page.isEndOfStream());

        // Check if there is a lost page
        if (page.pageSequenceNumber - 1 !== this.lastPageNumber) {
            throw new OggError('Lost data; missing page.');
        }

        this.lastPageNumber = page.pageSequenceNumber;
        this.currentPage = page;

        return true;
    }
}
