import path from 'node:path';

export default [
    { name: 'player', target: 'web', entry: './build/src/browser/dom/entryPoint.js' },
    { name: 'worker', target: 'webworker', entry: './build/src/browser/worker/worker.js' }
]
    .map(function ({ name, target, entry }) {
        return {
            name,
            target,
            entry,
            mode: 'production',
            devtool: 'source-map',
            module: {
                rules: [ {
                    test: /\.js$/u,
                    include: path.resolve(
                        import
                            .meta
                            .dirname,
                        'build/src'
                    ),
                    extractSourceMap: true
                } ]
            },
            output: {
                path: path.resolve(import.meta.dirname, 'build/assets'),
                filename: `${name}.js`
            }
        };
    });
