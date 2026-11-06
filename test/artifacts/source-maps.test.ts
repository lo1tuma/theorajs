import { readFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import path from 'node:path';
import { match, P } from 'ts-pattern';
import test from 'ava';

const root = path.resolve(import.meta.dirname, '../../..');

async function loadSourceMap(file: string): Promise<SourceMap> {
    const value: unknown = JSON.parse(await readFile(path.join(root, file), 'utf8'));
    const payload = match(value)
        .with({
            version: 3,
            file: P.string,
            sources: P.array(P.string),
            sourcesContent: P.array(P.string),
            names: P.array(P.string),
            mappings: P.string
        }, function (data) {
            return { ...data, sourceRoot: '' };
        })
        .otherwise(function () {
            throw new Error('Invalid source map.');
        });
    return new SourceMap(payload);
}

function mapsToTypeScript(map: SourceMap, code: string): boolean {
    return code.split('\n').some(function (line, row) {
        return Array.from(line).some(function (_character, column) {
            const entry = match(map.findEntry(row, column))
                .with({ originalSource: P.string }, function (value) {
                    return value.originalSource;
                })
                .otherwise(function () {
                    return '';
                });
            return entry.endsWith('.ts');
        });
    });
}

test('JavaScript maps resolve to embedded TypeScript sources', async function (t) {
    for (const file of [ 'build/src/lib/theora/decoder.js', 'build/assets/player.js', 'build/assets/worker.js' ]) {
        const code = await readFile(path.join(root, file), 'utf8');
        t.true(code.includes(`sourceMappingURL=${path.basename(file)}.map`));
        t.true(mapsToTypeScript(await loadSourceMap(`${file}.map`), code));
    }
});
