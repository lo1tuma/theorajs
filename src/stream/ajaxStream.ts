import { ByteStream } from './byteStream';

const fetch = function(url: string, callback: Function) {
    // To-do: ajax: cross browser compatibility
    const req = new XMLHttpRequest();

    // XHR binary charset
    req.overrideMimeType('text/plain; charset=x-user-defined');
    req.open('GET', url, true);

    req.onreadystatechange = function() {
        if (req.readyState === 4) {
            if (typeof callback === 'function') {
                callback(req.responseText);
            }
        }
    };

    req.send(null);
};

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
    fetch(callback: Function) {
        const self = this;
        fetch(this.url, (data: string) => {
            self.setData(data);
            callback();
        });
    }
}
