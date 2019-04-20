'use strict';

module.exports = {
    hooks: {
        readPackage
    }
};

function readPackage(pkg) {
    if (pkg.name === 'xo') {
        pkg.dependencies = {
            ...pkg.dependencies,
            eslint: '6.0.0-alpha.0'
        };
    }

    return pkg;
}
