import { rm } from 'node:fs/promises';
import test from 'ava';
import { createProbeDirectory, runProbe } from '../lib/runner-probes.ts';

for (
    const { title, failureKind } of [
        { title: 'assertion failure', failureKind: 'assertion' },
        { title: 'delayed rejection', failureKind: 'body-error' },
        { title: 'cleanup failure', failureKind: 'cleanup-error' },
        { title: 'cooperative timeout', failureKind: 'timeout' }
    ]
) {
    test.serial(`Overkill reports ${title} and awaits cleanup`, async function (t) {
        const directory = await createProbeDirectory();
        t.teardown(async function () {
            return rm(directory, { recursive: true, force: true });
        });
        const { code, result } = await runProbe(directory, title);

        t.like(result, {
            status: 'failed',
            summary: { discovered: 5, planned: 1, passed: 0, failed: 1, runtimePolicy: 0 },
            runnerErrors: []
        });
        t.is(code, 1);
        t.is(result.perTest.length, 1);
        const failures = result.perTest.flatMap(function caseFailures(entry) {
            return entry.outcome?.kind === 'fail' ? entry.outcome.failures : [];
        });
        t.true(failures.some(function cleanupCompleted(failure) {
            return failure.kind === 'cleanup-error' && failure.error.message === 'Cleanup completed';
        }));
        t.true(failures.some(function expectedFailure(failure) {
            return failure.kind === failureKind;
        }));
    });
}

test.serial('Overkill awaits async work and successful cleanup', async function (t) {
    const directory = await createProbeDirectory();
    t.teardown(async function () {
        return rm(directory, { recursive: true, force: true });
    });
    const { code, result } = await runProbe(directory, 'async completion');

    t.like(result, {
        status: 'passed',
        summary: { discovered: 5, planned: 1, passed: 1, failed: 0, runtimePolicy: 0 },
        runnerErrors: []
    });
    t.is(code, 0);
    t.is(result.perTest.length, 1);
    t.like(result.perTest[0], { verdict: 'pass', outcome: { kind: 'pass' } });
});
