import { ByteStream } from '../../lib/stream/byteStream';

export class AjaxStream extends ByteStream {
    private url: string;

    /**
     * Load a remote binary file using ajax.
     *
     * @class AjaxStream
     * @namespace Stream
     * @param {String} url Url which should be fetched.
     * @constructor
     * @extends ByteStream
     */
    constructor(url: string) {
        super();
        // To-do: read data chunk-wise
        this.url = url;
    }

    /**
     * Fetch
     *
     * @method fetch
     * @param {Function} callback
     */
    fetch(callback: () => void): void {
        fetch(this.url, { method: 'GET' }).then((response) => {
            if (response.ok) {
                response.arrayBuffer().then((buffer) => {
                    this.setData(buffer);
                    callback();
                });
            }
        });
    }
}
