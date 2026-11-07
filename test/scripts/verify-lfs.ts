import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';
import { isMatching, P } from 'ts-pattern';

const manifest: unknown = JSON.parse(await text(process.stdin));
const isManifest = isMatching({
    files: P.array({ name: P.string, size: P.number, oid: P.string, oid_type: 'sha256' })
});
assert.ok(isManifest(manifest), 'Expected Git LFS file metadata');
assert.ok(manifest.files.length > 0, 'Expected LFS fixtures');

for (const entry of manifest.files) {
    const payload = await readFile(entry.name);
    assert.equal(payload.byteLength, entry.size, `${entry.name}: incorrect size`);
    assert.equal(createHash('sha256').update(payload).digest('hex'), entry.oid, `${entry.name}: incorrect SHA-256`);
}
