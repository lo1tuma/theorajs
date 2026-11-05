theorajs
========

Theora Decoder in JavaScript

Demo: http://lo1tuma.github.com/theorajs/

Granule positions
-----------------

`Page.granulePosition` contains `lowBits` (unsigned 32-bit) and `highBits`
(signed 32-bit). This preserves all 64 bits without floating-point rounding.
The unknown position has `lowBits = 4294967295` and `highBits = -1`.

Coefficient regression fixture
------------------------------

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

Independent decoding reference
------------------------------

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
