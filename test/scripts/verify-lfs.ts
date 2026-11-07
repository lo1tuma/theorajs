import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const manifest: unknown = JSON.parse(execFileSync('git', [ 'lfs', 'ls-files', '--json' ], { encoding: 'utf8' }));
assert(typeof manifest === 'object' && manifest !== null && 'files' in manifest);
assert(Array.isArray(manifest.files) && manifest.files.length > 0);

const entries: readonly unknown[] = manifest.files;
for (const entry of entries) {
    assert(typeof entry === 'object' && entry !== null);
    assert('name' in entry && typeof entry.name === 'string');
    assert('size' in entry && typeof entry.size === 'number');
    assert('oid' in entry && typeof entry.oid === 'string');
    assert('oid_type' in entry && entry.oid_type === 'sha256');
    const payload = await readFile(entry.name);
    assert.equal(payload.byteLength, entry.size, `${entry.name}: incorrect size`);
    assert.equal(createHash('sha256').update(payload).digest('hex'), entry.oid, `${entry.name}: incorrect SHA-256`);
}
