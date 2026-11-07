import { setTimeout as delay } from 'node:timers/promises';
import { suite, test, type TestScope } from '@overkill-dev/test';

function verifyCleanup(scope: TestScope, reportCompletion: boolean): void {
    let disposed = false;
    scope.cleanup(function verifyDisposal() {
        if (!disposed) {
            throw new Error('Cleanup ordering violated');
        }
        if (reportCompletion) {
            throw new Error('Cleanup completed');
        }
    });
    scope.cleanup(async function disposeResource() {
        await delay(10);
        disposed = true;
    });
}

export const testNode = suite('runner readiness', [
    test('async completion', async function (scope) {
        verifyCleanup(scope, false);
        const actual = await Promise.resolve(42);
        scope.assert.equal(actual, 42);
        return scope.assert.collect();
    }),
    test('assertion failure', function (scope) {
        verifyCleanup(scope, true);
        scope.assert.equal(41, 42);
        return scope.assert.collect();
    }),
    test('delayed rejection', async function (scope) {
        verifyCleanup(scope, true);
        await delay(10);
        throw new Error('Delayed rejection');
    }),
    test('cleanup failure', function (scope) {
        verifyCleanup(scope, true);
        scope.assert.equal(42, 42);
        return scope.assert.collect();
    }),
    test({
        title: 'cooperative timeout',
        controls: { timeoutMilliseconds: 100 },
        async body(scope) {
            verifyCleanup(scope, true);
            await new Promise<void>(function (resolve) {
                scope.signal.addEventListener('abort', function () {
                    resolve();
                }, { once: true });
            });
            scope.assert.true(scope.signal.aborted);
            return scope.assert.collect();
        }
    })
]);
