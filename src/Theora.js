/**
 * Theora.js implements an ogg reader and a theora video decoder.
 *
 * @module TheoraJS
 * @class TheoraJS
 * @main TheoraJS
 */
const TheoraJS = {};

(function() {
    'use strict';

    /**
	 * Provides a namespace.
	 * An existing namespace won't be re-created.
	 *

		var module = TheoraJS.namespace("MyModule.MySubModule");

	 * @method namespace
	 * @param {String} namespace Namespace specifier
	 * @static
	 */
    TheoraJS.namespace = function(namespace) {
        let parts = namespace.split('.');
        let parent = TheoraJS;
        let i;

        // Strip redundant leading global
        if (parts[0] === 'TheoraJS') {
            parts = parts.slice(1);
        }

        for (i = 0; i < parts.length; i += 1) {
            // Create a property if it doesn't exist
            if (typeof parent[parts[i]] === 'undefined') {
                parent[parts[i]] = {};
            }

            parent = parent[parts[i]];
        }

        return parent;
    };

    /**
     * Mixes all obj2 members into obj1.
     *
     * @method mixin
     * @static
     * @param {Object} obj1
     * @param {Object} obj2
     */
    TheoraJS.mixin = function(obj1, obj2) {
        let member;

        for (member in obj2) {
            if (obj2.hasOwnProperty(member)) {
                if (!obj1.hasOwnProperty(member)) {
                    obj1[member] = obj2[member];
                }
            }
        }
    };

    /**
     * Inherits parents prototype to the child
     *
     * @method inherit
     * @param {Function} child
     * @param {Function} parent
     * @static
     */
    TheoraJS.inherit = (function() {
        const F = function() {};
        return function(child, parent) {
            F.prototype = parent.prototype;
            child.prototype = new F();
            child.uber = parent.prototype;
            child.uber.constructor = parent;
            child.prototype.constructor = child;
        };
    })();
})();
