# Aetheris

A procedural planet that changes forever without degenerating. One self-contained
`index.html` — hand-rolled WebGL2, no libraries, no build step, **zero network
requests**. Published to GitHub Pages at https://donmarshworks.github.io/aetheris/

## Working on it

- `index.html` is the entire program. Edit it directly.
- Serve locally: `python -m http.server 8000` then open `http://localhost:8000/`
  (it also works from `file://`, but test served — that is how it ships).
- **Verify changes: `npm run verify`.** One-time setup: `npm i` then
  `npx playwright install chromium`. Takes a few minutes — it renders in
  software so results are deterministic on any machine. `npm run verify --
  --static` runs only the instant static checks.
- `npm run serve` starts a local server on :8000.
- Deploy: commit and push to `main`. Pages redeploys automatically.

## Invariants — do not break these

1. **Zero external requests.** No CDN, no web fonts, no fetched images. The
   favicon is an inline SVG data URI. `verify.js` fails the build if anything
   leaves the origin.
2. **Climate homeostasis.** Over a simulated hour: ocean 62–65%, ice 6–12%, and
   forest / grass / desert all non-zero. No environment may vanish or take over.
   This is the entire point of the piece.
3. **Adaptive resolution** must keep it near 60fps; it lowers DPR when frames
   are slow. Don't add unconditional per-fragment cost.
4. **Page must never zoom or scroll.** The interface stays a fixed size; only
   the planet scales. See touch notes below.

## Architecture

Single file, in this order: CSS → HUD markup → math helpers → CPU Perlin noise →
simulation (grid, fields, controller) → WebGL setup → shaders (sky bake,
background/stars, planet, clouds, atmosphere) → camera/input → HUD → boot →
frame loop.

**Simulation.** A 320×160 lat/lon grid stepped ~12×/second. Terrain is six
octaves of Perlin noise on the sphere, each slowly rotating on its own axis and
breathing in amplitude — that drift is what moves coastlines. Climate derives
temperature, moisture, vegetation and snow per cell. Fields upload to an
`RGBA16F` texture as `(elevation, vegetation, snow, moisture)`.

**The controller** is the thing that keeps it alive. Three global dials — sea
level, global temperature, humidity — are steered by measuring coverage and
correcting toward targets. Corrections are **rate-limited**, because time-lapse
hands the loop enormous timesteps. If you change gains, re-check bounds at ×100.

**Rendering.** The shader reads the grid through a Catmull-Rom sampler with
analytic derivatives, and adds fractal detail so a coarse grid yields organic
coastlines.

**Test hooks.** `window.__world` exposes `S` (state), `advance()`, `freeze()`,
`setView()`, `sunDir()`, `cam()`, `pointerCount()`, `debug()`. Used by
`verify.js`. Keep them working.

## Hard-won lessons

Every one of these was a real bug that shipped and had to be diagnosed. They are
easy to reintroduce.

**GLSL**

- `smoothstep(a, b, x)` with `a > b` is **undefined behaviour**, not a reversed
  ramp. Always ascending; use `1.0 - smoothstep(lo, hi, x)` to descend. Symptom:
  the feature silently vanishes on some drivers (this hid the entire starfield).
  `verify.js` scans for this statically.
- Noise gradient vectors must be **normalised to unit length**. Unnormalised
  hashes bias toward cube diagonals and produce a herringbone lattice.
- **Never finite-difference the interpolated grid.** Smoothstep-bilinear has a
  gradient of exactly zero on every cell boundary, so differencing it beats
  against the grid and draws stripes across mountain belts. Use `heightCR()`,
  which returns value and both derivatives from one 4×4 neighbourhood.
- **Band-limit fine detail** against the pixel footprint (`pw`, `fadeA`,
  `fadeB`). Anything finer than a pixel aliases into moiré.
- Compute `dFdx`/`dFdy` **before** any branching — derivatives inside
  non-uniform control flow are undefined.
- Sphere triangles must wind **counter-clockwise seen from outside**. Backwards
  winding makes `cullFace` render the far hemisphere and the atmosphere shell
  paint over the whole disc.

**Looking like a planet, not a terrain demo**

- **Relief is capped at ~13° of normal tilt.** From orbit Everest is 9 km against
  a 6,370 km radius; ranges read by *snow and rock colour*, not shadow. Anything
  stronger looks like a rendering bug.
- The **terminator is driven by the geometric normal**, never the bumped one.
  With the sun near-tangent, small relief tilts throw whole regions into shadow
  and the coarse grid shows through as blotches. `reliefMix` fades relief in as
  the sun climbs.
- **Clamp elevation at sea level before differentiating**, or the continental
  shelf drop reads as a cliff and every coastline throws a shadow.
- **Barren ground colour must depend on temperature.** Cold desert is grey-brown
  rock; hot desert is sand. Keying both to sand means melting snow uncovers the
  Sahara at 45° latitude.
- The **tangent frame must not switch basis** at high latitude — that draws a
  hard circle around each pole. Use the lat/lon frame everywhere with a smooth
  floor on `cos(lat)`.
- **Atmosphere:** evaluate the sun angle along the whole chord of air a sightline
  crosses, not at the tangent point. Sampling one point makes the limb go dark
  exactly when the star passes behind the planet — the best shot in the piece.

**Input**

- Pointers are tracked in a **`Map` keyed by pointer id**. One orbits, two pinch.
  **Re-baseline deltas on every transition** — feeding a second finger's position
  into the rotation baseline jerks the planet by the distance between fingers.
- `touch-action: none` on body and canvas, plus `user-scalable=no`, plus
  `preventDefault` on Safari `gesture*` events and ctrl+wheel. Without all four,
  the browser zooms the page and the interface scales with the planet.
- Read tap positions from the **tracked pointer**, not the release event; some
  touch stacks report zeroes there.
- Clear tracked pointers on `blur`/`visibilitychange`, or a lost release jams
  input permanently.

## Style

British-ish spelling in prose, comments explain *why* not *what*. The HUD states
the three time scales explicitly (a day 2.5 min, a year 15 min, continents
~40 min) rather than inventing a single geological clock, because those are
compressed by factors differing by nine orders of magnitude and any one counter
would contradict the others. Erosion and real plate tectonics are **not**
modelled — don't claim otherwise in the README.

## Next feature

Evolving plants competing for exclusive area. See `docs/plants-design.md` for the
agreed model and open questions. Read it before starting that work.
