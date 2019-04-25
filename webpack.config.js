'use strict';

const path = require('path');

module.exports = {
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    projectReferences: true
                }
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    entry: {
        player: './src/browser/dom/entryPoint.ts',
        worker: './src/browser/worker/worker.ts'
    },
    output: {
        path: path.resolve(__dirname, './build/assets/[hash]/'),
        filename: '[name].js'
    }
};
