import { baseConfig, withCspellWords } from '@enormora/eslint-config-base';
import { typescriptConfig } from '@enormora/eslint-config-typescript';
import { nodeConfig, nodeConfigFileConfig } from '@enormora/eslint-config-node';
import { browserConfig } from '@enormora/eslint-config-browser';
import { avaConfig, testSupportConfig } from '@enormora/eslint-config-ava';

export default [
    ...baseConfig,
    {
        files: [ '**/*.{js,ts}' ],
        ...withCspellWords([
            'luma',
            'chroma',
            'macroblock',
            'superblock',
            'Theora',
            'Ogg',
            'Huffman',
            'quantizer',
            'quantizers',
            'Xiph',
            'dequantize',
            'dequantized',
            'eos'
        ])
    },
    { ...typescriptConfig, files: [ 'src/**/*.ts', 'test/**/*.ts' ] },
    { ...nodeConfig, files: [ 'test/**/*.ts', '*.config.js' ] },
    { ...nodeConfigFileConfig, files: [ '*.config.js' ] },
    { ...browserConfig, files: [ 'src/browser/**/*.ts' ] },
    {
        ...avaConfig,
        files: [ 'test/{unit,integration,artifacts,browser}/**/*.test.ts', 'test/**/*.bench.ts' ],
        ignores: [ 'test/integration/theora/reference.test.ts' ]
    },
    {
        ...testSupportConfig,
        files: [ 'test/lib/**/*.ts', 'test/integration/theora/reference.test.ts', 'test/runner/**/*.ts' ]
    }
];
