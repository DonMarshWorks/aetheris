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
background/stars, planet, clouds, ring, atmosphere) → camera/input → HUD →
boot → frame loop.

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

**The ring** lies in the equatorial plane, which is fixed in space — so its
mesh is built once in world coordinates from `POLE` and never transformed
again. Drive it from `uRot` and it would spin with the surface every 2½
minutes. `GLSL_RING` is shared by the ring, the planet and the clouds so that
one radial density profile decides both how solid the ring looks and how dark
the shadow it throws is; they cannot drift apart. The radii stand well off the
planet on purpose — held close the ring borrows this world's Earth-like scale
and both read as small — which costs framing at the edges. See the comment on
`RING_R0`.

**The ring's shadow** must floor its divide by `dot(sun, POLE)`. Twice a year
the sun crosses the ring plane, the sunlight's path through the ring runs to
infinity, and an honest divide saturates the band into a hard black stripe at
exactly equinox. It is also penumbra-blurred in proportion to how far the
shadow has been thrown, or the ring's fine banding survives to the ground and
the band lands with cut edges.

**Test hooks.** `window.__world` exposes `S` (state), `advance()`, `freeze()`,
`setView()`, `sunDir()`, `cam()`, `pointerCount()`, `debug()`. Used by
`verify.js`. Keep them working.

## Hard-won lessons

Every one of these was a real bug that shipped and had to be diagnosed. They are
easy to reintroduce.

**JavaScript**

- **A leftover function declaration silently wins.** Replacing a function but
  leaving the old definition further down the file means the *old* one is what
  runs, everywhere, because declarations hoist and the last wins. A stale
  `fitAt` shadowed its replacement for four commits. What hid it: the dead
  version read properties off a number, returned `NaN`, and `NaN|0` is `0` — so
  a `Math.max(floor, ...)` downstream turned a total failure into a plausible
  constant. Nothing threw, nothing logged, and several parameters simply had no
  effect. When a parameter provably does nothing, instrument the line that uses
  it before theorising about why; and grep for duplicate definitions first.

**GLSL**

- **Never write a backtick inside shader source**, including in comments. The
  shaders live in JS template literals, so a backtick closes the literal and
  the rest of the shader is parsed as JavaScript. The failure is a syntax error
  somewhere else entirely and the offending line looks like ordinary prose.
  `verify.js` checks statically that every shader reaches its `void main`.
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
- **A flat thing seen edge-on has no thickness to rasterise.** Band-limiting
  the density cannot save it — the rasteriser never generates the fragments, so
  the ring breaks into crawling dashes. Fix it at the vertex stage: push the
  proxy apart by a fixed number of *pixels* (not world units, so it survives
  resolution changes and the adaptive DPR), shade from the view ray, and taper
  the alpha across that push — but only once the ring is thin enough for the
  rim to be what is covering, or the taper eats the cap at every ordinary
  angle and the ring vanishes at 45°.

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

Evolving plants competing for exclusive area — branching growth in continuous
position, not a grid mosaic. Lives on the `plants` branch, not yet merged.
Three documents, and they are split by what you need:

- `docs/plants-design.md` — the model as it now stands, the build order, the
  invariants. Start here.
- `docs/plants-measured.md` — the evidence. Every claim that was tested and
  what the testing said, including the several it destroyed. **Read this
  before trying an idea that sounds obvious**: ocean nutrient limitation was
  judged harmful twice and is now the default, frequency dependence failed
  twice on two different questions, and a retry allowance measured optimal at
  two different values without the constant changing.
- `docs/formula-design.md` — the formula genome that replaced the scalar one,
  and the four of its claims that measurement overturned.

**The harness is what breaks.** Four times now the thing reporting the
measurement has been wrong rather than the thing measured: a stale `fitAt`
shadowing its replacement, `runWorld` paying one ecology step per climate tick,
`runWorld`'s default drifting away from the frame loop's accrual, and
`sweep.js` stopping the frame loop a moment too late and so measuring a
different world every run. A harness is code nobody tests, reporting on code
everybody tests. The counters that catch it are the ones asserting something
that *must* be true — that two identical runs are identical, that a metric
which must be 1.000 is. Assert those first.

And use `tools/score.js`. It refuses to average a dead planet into a mean; a
second analysis path written in a hurry does not, and one that did cost two
hours chasing a build difference that never existed.

**Measure, do not reason, and build the counter before the mechanism.** Every
finding on this branch came from `window.__world.plants()` and none from
argument; two settled design decisions were wrong and one of them cost an order
of magnitude in body size. The hooks — `runWorld(ticks, mult)`, `growPlants`,
`plants()`, `printGenome()`, and every `PARAMS` entry overridable from the URL
hash (`#seed=7&glen=48`) — exist so a variant costs a minute. Single seeds vary
more than the effects worth chasing, so average four.
