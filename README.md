# theorajs

Theora Decoder in JavaScript

Demo: http://lo1tuma.github.com/theorajs/

## Development

Install Node.js 26.13.0 with its bundled npm 11.20.0, plus Git LFS.
Development commands reject other Node or npm versions.

```sh
git lfs install
git lfs pull
git lfs fsck
npm ci
npm run build
npm run lint
npm run test:unit
npm run test:integration
```

TypeScript compiles the source before Rspack bundles the emitted JavaScript.
The browser bundles are `build/assets/player.js` and `build/assets/worker.js`.
Serve them over HTTP with the video fixture and a container whose id is `test`:

```html
<script src="/player.js" data-video-url="/video.ogg" data-worker-url="/worker.js"></script>
```

`npm run test:bench` runs the historical CPU-frequency-based benchmarks.
Their thresholds are host-dependent and are separate from correctness checks.
`npm test` runs lint, unit tests, independent-reference tests, and integration tests.
The independent-reference family runs on pinned Overkill. Other families retain
AVA. `npm run test:reference` runs the migrated family; `npm run test:runner`
verifies async completion, assertions, cleanup, timeout, and exit behavior through
structured results. Runner verification also runs with the integration tests.

Development artifacts are checked separately:

```sh
npm run test:artifacts
npm run install:browser
npm run test:browser
```

Artifact checks consume emitted ESM and declarations outside the source tree.
Browser checks use pinned Playwright Chromium and exercise the player and worker
bundles. Chromium coverage does not establish Chrome, Firefox or Safari coverage.
Playwright is temporary until Overkill proves browser execution, provisioning,
timeouts, cleanup and failure reporting. The known playback queue-drain
limitation remains outside this smoke check. These internal artifact paths do
not define the eventual public package API.

The compiler enforces strict checks. ESLint uses the shared Enormora presets
with zero warnings. Required bitwise expressions are isolated in the integer
arithmetic module, with an exception on each expression only.

## Granule positions

`Page.granulePosition` contains `lowBits` (unsigned 32-bit) and `highBits`
(signed 32-bit). This preserves all 64 bits without floating-point rounding.
The unknown position has `lowBits = 4294967295` and `highBits = -1`.

## Coefficient regression fixture

`test/fixtures/coefficient-range.ogv` is a generated 32 by 32 white frame,
encoded with FFmpeg 8.1.3 and libtheora 1.2.0. It contains a DC coefficient
of 214, exceeding signed 8-bit storage. The expected decoded planes are
uniform Y=235, Cb=128, Cr=128, independently checked with FFmpeg's native
Theora decoder. The generated pattern contains no third-party media.

```sh
ffmpeg -f lavfi -i color=white:size=32x32:rate=4 -frames:v 1 \
    -c:v libtheora -q:v 10 -fflags +bitexact -flags:v +bitexact \
    test/fixtures/coefficient-range.ogv
ffmpeg -c:v theora -i test/fixtures/coefficient-range.ogv \
    -f rawvideo -pix_fmt yuv420p coefficient-range.yuv
```

The raw reference is 1536 bytes: 1024 luma bytes followed by 256 bytes for
each chroma plane. Reference generation runs separately from test assertions.

Fixture SHA-256:
`943470416bb7e1d0f9d3cd2cfca6b76e092fcd54bf35ffdb1581dfda9c681892`.

## Independent decoding reference

`test/fixtures/prediction.ogv` contains four 32 by 32 test-pattern frames
in 4:2:0 format, covering key and inter prediction. It was generated with
FFmpeg 8.1.3 and libtheora 1.2.0, without third-party media:

```sh
ffmpeg -f lavfi -i testsrc2=size=32x32:rate=4 -frames:v 4 \
    -c:v libtheora -g 4 -q:v 5 prediction.ogv
ffmpeg -c:v theora -i prediction.ogv -f rawvideo -pix_fmt yuv420p prediction.yuv
```

The checked-in `prediction.yuv` was independently confirmed with Xiph's
libtheora 1.2.0 decoder. Both decoders produced identical 6144-byte output.
Each frame stores Y, Cb and Cr with strides 32, 16 and 16, in top-to-bottom
row order, with no crop or RGB conversion. Tests normalize decoder plane
orientation before comparing every byte.

SHA-256 identities:

- Input: `cb8219d1ad5e1d152b11c6ea8a5a26bad4a5edb289af03854621260ecf6a2630`
- Reference: `e446dafecca9f28b94d175f477ed7d97b86343052d52459db378abb4ed690f2a`

## Trailer image references

The 813 PNGs in `test/reference-pictures/trailer_400p` are generated from
independent raw planes, separately from test execution. The original image
references remain available at revision `98235c7`.

The trailer and its frame images are derived from
[Big Buck Bunny](https://peach.blender.org/about/), licensed under
[Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
Attribution: (c) copyright 2008, Blender Foundation / [www.bigbuckbunny.org](https://www.bigbuckbunny.org/).
The PNGs are decoded, color-converted stills from that trailer.

The input is the existing 720 by 400, 4:2:0 trailer fixture. FFmpeg 8.1.3's
native Theora decoder and Xiph libtheora 1.2.0 produced identical raw planes
for all 813 frames. SHA-256 identities:

- Input: `dcbe6f2ea404a52d4b2f6fc91f274874e69be1671a1097eb3dc19f28f7c6e40f`
- Raw planes: `a221a2efaf04ad1a072f5ea0d927cfcd93091ac2f889ac4e5aaa94e1430d8951`

The PNG generator used Node.js `11.13.0` and `pngjs` `3.4.0`.
Use FFmpeg 8.1.3 and the existing project compiler to reproduce candidates:

```sh
mkdir -p build/reference
ffmpeg -c:v theora -i test/fixtures/trailer_400p.ogg -map 0:v:0 \
    -fps_mode passthrough -f rawvideo -pix_fmt yuv420p build/reference/trailer_400p.yuv
node build/test/scripts/framesToImages.js build/reference/trailer_400p.yuv \
    build/reference-candidates/trailer_400p
```

The generator rejects any raw input with a different length or checksum.
Review candidate images before replacing the checked-in references.

Raw frames contain Y, Cb, Cr with strides 720, 360, 360 and top-to-bottom
rows, without padding or cropping. Chroma uses nearest-neighbor 2 by 2
replication. The reference conversion contract is:

```text
y = (Y - 16) / 219
pb = (Cb - 128) / 224
pr = (Cr - 128) / 224
r = y + 1.402 * pr
g = y - 0.344136286 * pb - 0.714136286 * pr
b = y + 1.772 * pb
```

Clamp each channel to `[0, 1]`, multiply by 255, and truncate downward.
Alpha is 255 for every pixel. PNGs store RGBA at 8 bits per channel with
no color-profile transformation. The integration test compares dimensions
and all RGBA bytes exactly; visual diffs are diagnostic only. Failures retain
at most three expected/actual/diff image sets.
