import { Packet } from './packet';
import { TransportStream } from './transportStream';
import { Page } from './page';

export class LogicalStream {
    private stream: TransportStream;

    public serialNumber: number;

    private currentPage: Page;

    private segmentOffset: number;

    private initialPacket: false | Packet;

    private lastPageNumber: number;

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
            throw {
                name: 'OggError',
                message: 'LogicalStream must be initialized with a BeginOfStream page.'
            };
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
        // TODO: reading the initialPacket here and resetting the segment offset causes a bug when the first packet spans multiple pages, since we don’t reset currentPage
        this.initialPacket = this.nextPacket();

        // Reset offset, so we can re-read the initial packet with nextPacket()
        this.segmentOffset = 0;
    }

    /**
     * Gets the next packet.
     *
     * @method nextPacket
     * @return {Ogg.Packet}
     */
    nextPacket() {
        const packet = new Packet();
        let segment: false | ReadonlyArray<number>;

        segment = this.nextSegment();
        if (!segment) {
            return false;
        }

        // Add segments to the current packet
        // a segment length < 255 means it is the last segment of the current packet
        while (segment.length === 255) {
            packet.addSegment(segment);
            segment = this.nextSegment(true);
            if (!segment) {
                throw {
                    name: 'OggError',
                    message: 'Missing EndOfPacket segment'
                };
            }
        }

        // Add last segment
        packet.addSegment(segment);

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
    nextSegment(checkForContinuation?: boolean): false | ReadonlyArray<number> {
        let ret;
        let segment;

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
                    throw {
                        name: 'OggError',
                        message: 'Page is not a continud page.'
                    };
                }
            }

            this.segmentOffset = 0;
        }

        segment = this.currentPage.segments[this.segmentOffset];
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
    nextPage() {
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
            throw { name: 'OggError', message: 'Lost data; missing page.' };
        }

        this.lastPageNumber = page.pageSequenceNumber;
        this.currentPage = page;

        return true;
    }
}
