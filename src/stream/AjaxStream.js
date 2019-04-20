TheoraJS.namespace('Stream').AjaxStream = (function() {
    'use strict';

    // Dependencies
    const byteStream = TheoraJS.namespace('Stream').ByteStream;

    // Private variables
    let Constructor;

    // Private methods
    const fetch = function(url, callback) {
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

    /**
     * Load a remote binary file using ajax.
     *
     * @class AjaxStream
     * @namespace Stream
     * @param {String} url Url which should be fetched.
     * @constructor
     * @extends ByteStream
     */
    Constructor = function(url) {
        // To-do: read data chunk-wise
        this.url = url;
        // Call super constructor
        Constructor.uber.constructor.call(this);
    };

    // Inheritance
    TheoraJS.inherit(Constructor, byteStream);

    // Reset constructor reference
    Constructor.prototype.constructor = TheoraJS.namespace('Stream').AjaxStream;

    /**
     * Fetch
     *
     * @method fetch
     * @param {Function} callback
     */
    Constructor.prototype.fetch = function(callback) {
        const self = this;
        fetch(this.url, data => {
            self.setData(data);
            callback();
        });
    };

    return Constructor;
})();
