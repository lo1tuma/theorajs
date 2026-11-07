import { defineConfig } from '@overkill-dev/test/config';

export const config = defineConfig({
    profiles: {
        reference: {
            testFamily: 'integration',
            files: { include: [ 'build/test/overkill/**/*.test.js' ] }
        }
    }
});
