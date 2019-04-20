import { ByteStream } from '../stream/byteStream';
import { LogicalStream } from './logicalStream';
import { Page } from './page';

export class TransportStream {
    private byteStream: ByteStream;
    private logicalStreams: LogicalStream[];

    /**
     * The transport stream is the multiplexed physical stream of an ogg container.
     *
     * @class TransportStream
     * @namespace Ogg
     * @constructor
     * @param {Stream.ByteStream} stream
     */
    constructor(stream: ByteStream) {
        this.byteStream = stream;
        this.logicalStreams = [];
    }

    /**
         * Lookup for all logical ogg streams.
         *
         * Note: This method uses a lazy function definition, so avoid references to this method.
         *
         * @method findLogicalStreams
         * @return {Array} Array of all LogicalStream instances.
         */
    findLogicalStreams() {
        let page;

        // Lookup for all logical streams
        // a logical stream is identified by a ogg page where the BeginOfStream flag is true
        // all BeginOfStream pages have to be in order, before any other page follows
        page = this.nextPage();
        while (page.isBeginOfStream()) {
            this.logicalStreams.push(new LogicalStream(this, page));
            page = this.nextPage();
        }

        // Unread last page, because it was't a BoS page
        this.byteStream.skip(-(page.headerLength + page.bodyLength));

        // Override this method, because we have to do this work only once
        // to-do: check, if works... ?!
        TransportStream.prototype.findLogicalStreams = function () {
            return this.logicalStreams;
        };

        return this.logicalStreams;
    }

    /**
         * Get the next page in the transport stream.
         *
         * @method nextPage
         * @return {Ogg.Page}
         */
    nextPage() {
        // To-do: check if there are more pages available
        return new Page(this.byteStream);
    }
}
