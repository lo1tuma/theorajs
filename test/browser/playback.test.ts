import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFireAndForgetInvoker } from '@enormora/fire-and-forget';
import { chromium, type Page } from 'playwright';
import test, { type ExecutionContext } from 'ava';

const root = path.resolve(import.meta.dirname, '../../..');
const html = `<div id="test"></div><div id="info"></div><script>
window.report = { received: 0, drawn: 0, eos: false, width: 0, height: 0, errors: [] };
const NativeWorker = Worker;
window.Worker = class extends NativeWorker {
    constructor(...args) {
        super(...args);
        this.addEventListener('error', event => report.errors.push(event.message));
        this.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'success') Object.assign(report, message.data);
            if (message.type === 'data') {
                report.received++;
                if (message.frame.byteLength !== 320 * 240 * 4) report.errors.push('Wrong frame length');
            }
            if (message.type === 'error') report.errors.push(message.message);
            if (message.type === 'eos') report.eos = true;
        });
    }
};
const draw = CanvasRenderingContext2D.prototype.putImageData;
CanvasRenderingContext2D.prototype.putImageData = function(...args) {
    report.drawn++;
    return draw.apply(this, args);
};
</script><script src="/player.js" data-video-url="/fixture.ogg" data-worker-url="/worker.js"></script>`;

async function serveFile(file: string, response: ServerResponse): Promise<void> {
    try {
        response.end(await readFile(path.join(root, file)));
    } catch {
        response.writeHead(500).end();
    }
}

async function serveDemo(t: ExecutionContext): Promise<string> {
    const files = new Map([
        [ '/player.js', 'build/assets/player.js' ],
        [ '/worker.js', 'build/assets/worker.js' ],
        [ '/fixture.ogg', 'test/fixtures/320x240.ogg' ]
    ]);
    const invoker = createFireAndForgetInvoker({
        reportError(error) {
            t.log(String(error));
        }
    });
    const server = createServer(function (request, response) {
        invoker.fireAndForget(async function () {
            if (request.url === '/') {
                response.setHeader('Content-Type', 'text/html');
                response.end(html);
                return;
            }
            const file = files.get(request.url ?? '');
            if (file === undefined) {
                response.writeHead(404).end();
                return;
            }
            response.setHeader('Content-Type', file.endsWith('.ogg') ? 'video/ogg' : 'text/javascript');
            await serveFile(file, response);
        });
    });
    await new Promise<void>(function (resolve) {
        server.listen(0, '127.0.0.1', resolve);
    });
    t.teardown(function () {
        server.closeAllConnections();
        server.close();
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('Unable to listen for browser requests.');
    }
    return `http://127.0.0.1:${address.port}/`;
}

type BrowserSession = { readonly page: Page; readonly errors: readonly string[]; };

async function openDemo(t: ExecutionContext): Promise<BrowserSession> {
    const url = await serveDemo(t);
    const browser = await chromium.launch();
    t.teardown(async function () {
        await browser.close();
    });
    t.log(browser.version());
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', function (error) {
        errors.push(error.message);
    });

    await page.goto(url);
    return { page, errors };
}

test('browser bundles decode and draw video through a real worker', async function (t) {
    const { page, errors } = await openDemo(t);
    await page.waitForFunction('window.report.eos', null, { timeout: 30_000 });
    const result: unknown = await page.evaluate('window.report');
    t.log(JSON.stringify(result));
    t.like(result, { received: 121, width: 320, height: 240, eos: true, errors: [] });
    t.true(await page.evaluate('window.report.drawn > 0'));
    t.deepEqual(errors, []);
});

test('missing worker prevents playback and reports an error', async function (t) {
    const { page } = await openDemo(t);
    await page.route('**/worker.js', async function (route) {
        return route.abort();
    });
    await page.reload();
    await page.waitForFunction('window.report.errors.length > 0', null, { timeout: 30_000 });
    t.true(await page.evaluate('window.report.received === 0'));
});
