import { defineConfig } from '@overkill-dev/test/config';

export const config = defineConfig({
    runtimeStateDir: 'target/.overkill',
    profiles: {
        reference: {
            testFamily: 'integration',
            timeouts: { collectionMilliseconds: 30_000 },
            files: { include: [ 'build/test/integration/theora/reference.test.js' ] }
        }
    }
});
