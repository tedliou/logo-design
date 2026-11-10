# Geometry-first drawing (grids of 48 and up)

Read when drawing at 48 cells or more, or when translating a reference image.

## Measure a reference

Eyeballing coordinates from an image produced wrong proportions and colors in practice. Measure instead:

1. Decode the image to raw BGRA bytes. On Windows, PowerShell with WPF decodes WebP, PNG and JPEG:

   ```powershell
   Add-Type -AssemblyName PresentationCore
   $fs = [IO.File]::OpenRead($src)
   $d = [Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'PreservePixelFormat', 'OnLoad')
   $b = New-Object Windows.Media.Imaging.FormatConvertedBitmap($d.Frames[0], [Windows.Media.PixelFormats]::Bgra32, $null, 0)
   $buf = New-Object byte[] ($b.PixelWidth * 4 * $b.PixelHeight)
   $b.CopyPixels($buf, $b.PixelWidth * 4, 0); [IO.File]::WriteAllBytes($out, $buf); $fs.Close()
   ```

   Elsewhere: `magick in.webp -depth 8 bgra:out.bgra`.
2. Run `node <skill-dir>/scripts/refmap.mjs out.bgra W H --k 6 --frame x0,y0,x1,y1 --grid 96 --cells cx0,cy0,cx1,cy1`. It clusters the colors (median hex per cluster), finds strong horizontal and vertical lines (construction frames), and writes a cell map: each cell's majority cluster, placed so the pixel frame lands on the cell frame.
3. Read the cell map next to the image. Take vertices from it, then snap each edge to the nearest clean slope. Note where the reference uses one color as an effect (an overprint where lines cross a fill) rather than as an ink.

## Scene format for `scripts/raster.mjs`

A scene is an ES module: `export const size, palette, layers` and optionally `textureRules`. Layers draw in order; a layer with `optional: true` draws only when named in `--layers`.

| Item | Draws |
|---|---|
| `{ fill: 'P' }` | the whole canvas |
| `{ poly: [[x,y],...], c }` | polygon, pixel-centre sampling |
| `{ ray: [x,y], dir: [a,b], c, len?, gap?, clip? }` | straight line with exactly equal runs; `dir` must be a clean ratio ((2,1), (1,4), (1,1), (1,0)) |
| `{ path: [x,y], segs: [[axis, sx, sy, [runs]]], c, gap?, clip? }` | pixel curve: on axis `x` each run moves x, then steps y once |
| `{ text, at, c, vertical? }` | 3x5 pixel font (capitals, digits, `-/:`) |

- `blend: { under: result }` on any item maps the color underneath: `{ R: 'D' }` overprints a line on pink; `{ W: 'K', K: 'W' }` inverts a line against what it crosses; `{ W: 'W', K: 'W' }` draws a line only where it leaves a white window (implied convergence).
- `clip: [x0,y0,x1,y1]` cuts rays and paths; they may start outside the box. Ending every ray on one inset square makes the tips mark that square.
- `gap: n` leaves the first n cells around the origin empty, so converging lines do not form a knot.
- Shared edges: draw the lower shape larger and let the upper shape cut it. Two shapes drawn to the same edge separately leave 1-cell slivers.
- `--texture SEED` applies `textureRules` ({ color: { p, to } }) as sparse grain and marks the output `allowOrphans`.

Run: `node raster.mjs scene.mjs out.json [--layers a,b] [--texture 7]`, then `check.mjs`.

## Size ladder

1. Master (96): full geometry.
2. Half (48): halve every vertex, re-snap each edge to a clean slope by hand, rasterize, look.
3. 32 and 16: type rows as cell spans per row; geometry is too coarse here.
4. Drop details in a planned order, for example: crossing lines inside shapes, then small teeth or notches, then the number of radiating lines. Keep the outline and the accent color to the end.

## Organic lines

Whiskers, hair and antennae are tapered rods. Measured whiskers are close to truncated cones with a base about 10 times the tip diameter (Williams & Kramer 2010) and fit a one-coefficient parabola (Towal et al. 2011). Under its own weight a cone's bending moment and stiffness both scale with the fourth power of the remaining length, so the curvature is nearly constant: the sag is close to a circular arc (Euler-Bernoulli estimate, not a published result).

- Give every line of one kind the same radius; longer ones then droop further on their own.
- Spread the start angles from slightly upward to downward, so upper lines arch and lower lines hang. Stagger the roots along a short row instead of one point, or hide the roots, so the fan does not read as a starburst.
- Vector: centreline x = x0 + side·R(sin θ0 − sin φ), y = y0 + R(cos θ0 − cos φ) with φ falling from θ0 by s/R; offset both sides by a width that falls linearly from root to tip, and fill the outline.
- Pixels: sample one cell per column while the slope is under 45 degrees, one per row after; then sort the run lengths so they grow toward the highest point and shrink after it, which removes rounding jitter without moving the end.
- Taper at 1-cell width with value: draw the last quarter in a colour closer to the background.

## Closed marks

A seal or window (a dark field with the subject carved as a light panel) gives a pixel logo a closed silhouette that holds down to 16. Keep a 1-cell keyline between the panel edge and dark shapes inside it, or they merge with the field and break the panel. Let lines leave the panel into the field rather than run across the face.
