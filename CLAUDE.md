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

The sea-level correction is additionally **scaled by how much ground lies near
the waterline**, because the correction is in units of sea level and the thing
it steers is a share of the world, and the exchange rate between them is not a
constant. A smooth world piles its elevation into a narrow band, so one step
sweeps several times as much coastline: across the relief slider one correction
buys anywhere from 0.011 to 0.107 of ocean share, and above about 0.09 the loop
steps over its own target and limit-cycles. Evidence in
`docs/world-controls.md`.

**The settings panel** exposes four of these physically — sea level,
temperature, rainfall and relief — and `docs/world-controls.md` is what
measuring them said, including the two that were promising more than the world
would give. Slider ends are not a matter of taste: `window.__world.settings()`
reports them so a harness tests the control the visitor is given rather than a
copy of its numbers, and `tools/controls.js` is that harness.

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

**The tour** is the rocket button: a screensaver that flies the camera between
eleven chosen framings for as long as it is left on, and touches nothing but the
camera. `tools/tour.js` asserts it and `tools/tourshots.js` photographs every
framing. Several things about it are load-bearing.

It eases on **smootherstep**, not the frame loop's exponential. An exponential
ease arrives beautifully and *departs* at full speed — its velocity is greatest
at the instant it starts — and that is the jerk a passenger feels.
`t³(6t²−15t+10)` has zero first and second derivative at both ends. `tools/tour.js`
asserts the curve by its peak speed, 1.875× the mean; smoothstep would read
1.500 and a linear ramp 1.000.

`CAM.aim` and `CAM.up` are **carried apart from the orientation**, because the
two cannot always agree. `CAM.q` says where the eye *stands*, so its own up is
perpendicular to the line out to the eye — and out of a shuttle window the up
the picture wants is exactly that line. Asking one quaternion for both is asking
a vector to be perpendicular to itself. Both default to zero, which means "as it
always was", and every line behaves as it did before the tour existed.

**`rate` means the opposite of what it sounds like, and two shots were built on
the wrong reading.** It is how much of the planet's turn the eye shares. At **0**
the eye holds still against the SUN, so the lighting is nailed to the screen and
only the ground moves through it; at **1** it holds still against the GROUND, so
the terminator sweeps across at the full rate and a place really does go into
evening. "Watch the shade line arrive" therefore wants rate 1, not a slow drift,
and at 0.45 it was neither a fixed composition nor a real transition.

**The sun gets a vote on where to stand**, because half of everything is unlit at
any moment and a low pass over dark ground shows nothing. Candidates are scored
at `[flight, flight + dwell]` and not from the present instant — a geosynchronous
destination rides the ground while the camera is still flying to it, so scoring
now picks a spot beautifully lit at the moment nobody is looking at it. And
`edge` asks for the two ends to fall on OPPOSITE sides of the terminator, not for
a large change in the light: measured, rewarding the size of the swing picked
framings that changed enormously and stayed in daylight throughout, and crossed
6 times in 40 where asking for a crossing gives 34.

**A shot that wants the fine plant sheet must cap its zoom against the window.**
The detail patch is refused past `dist = 1/sin(corner)` and fades out on absolute
distance, but a *zoom* buys a different distance on every window shape — a tall
phone stands 2.5x further off than a laptop for the same framing. `holding one
place` was drawing the coarse sheet at the top of its own range on a laptop and
on every phone. `detailZoom()` derives the cap; `tour().detail` reports whether
the fine sheet is actually being drawn, which is the counter that was missing.

**Interpolate directions by turning, never by lerping.** A straight line between
two unit vectors sweeps its direction unevenly, and pathologically as the two
approach opposite — the path passes near the origin and the direction whips
through half a turn in a few frames. The tour's `up` did exactly that, and the
camera flicked on to its back rather than banking on to a new heading.
`vSlerp` turns about an axis; the harness measures the peak roll rate against the
mean and it reads 2.25 where the lerp read 27.

Two hazards it walked into and one it did not. `qFromBasis` builds its matrix by
**column**, so `R21` is Y's z and not Z's y; transposed it returns the conjugate,
which is a perfectly good unit quaternion pointing every camera exactly the wrong
way, and no length or dot product anywhere goes wrong. The detail patch sized
itself from the field of view alone, which was right only while the view axis
passed through the world's centre; off-axis it must add the angle between them.
And the tour draws from `Math.random` and **never `prnd()`** — a camera reaching
into the simulation's stream would make the route decide the planet.
`tools/tour.js` asserts two identical runs, one touring and one not, produce
byte-identical ecologies.

**Test hooks.** `window.__world` exposes `S` (state), `F` (the fields),
`advance()`, `runWorld()`, `freeze()`, `setView()`, `sunDir()`, `cam()`,
`pole()`, `ringPoint()`, `pins()`, `tour()`, `setTour()`, `tourGo()`,
`pointerCount()`, `debug()`, `params()`, `defaults()`, `settings()`,
`holdClimate()`, and the plant hooks in `plants-design.md`. Used by
`verify.js`, `sweep.js`, `controls.js` and `linkcheck.js`. Keep them working.
`holdClimate()` pins the three dials so the world can be asked where it
settles, which is the one question a controller steering toward a target can
never answer about itself.

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
- **Capture the defaults before the hash is applied, not after.** The settings
  panel writes a shareable link by naming every parameter that differs from the
  defaults. `DEFAULTS` was taken next to the panel, which runs after the URL has
  already been merged into `PARAMS` — so every setting that *arrived* in the
  link counted as a default and was dropped the moment the panel was opened.
  The restart button walked straight into it: it reloads with the settings in
  the hash, and reopening the panel on the other side threw them away. Nothing
  failed; the link just quietly described a different world. `tools/linkcheck.js`
  walks the four journeys that expose it.
- **Never sample a control loop at a multiple of its own period.** At ×100 a
  tick is 8.4 simulated seconds; sampling every 120 landed on the same phase of
  a limit cycle every time and drew a flat line through a world swinging by ten
  points. It read as a correction too *small* to arrive, which is the opposite
  of the fault and wants the opposite fix. What caught it was a cross-check that
  had no business disagreeing: the simulation's own census against an
  independent recomputation of the same quantity at the same instant.

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

**American spelling in everything the visitor reads** — the about panel, the
settings and graph cards, button labels. Comments and these documents stay
British-ish. Comments explain *why* not *what*. The HUD states
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

**The harness is what breaks — now well past a dozen times.** The tour's own
harness failed nine checks across five runs and every one of them was the
measurement rather than the thing measured. They came in four shapes, and all
four will recur:

- **A fixed millisecond wait for something only a frame can change.** A software
  renderer under load gives about seven frames a second, so 500ms is often less
  than one frame and every reading is of the state *before* what was asked for.
  The tell was two different shots reporting the identical number.
- **A metric that bends.** The angle between two orientations is `2*acos(|dot|)`,
  which saturates at a half turn and comes back *down* — so a long leg reads as
  doubling back and its derivative blows up. Accumulate arc length instead.
- **A derivative over a degenerate interval.** Frame times are uneven; one step
  in forty is 8ms where the rest are 230ms, and dividing any ordinary movement by
  it manufactures a 28x spike in a quantity that cannot exceed 1.875. Skip steps
  far shorter than the typical one.
- **Not stopping the frame loop.** `sweep.js` has carried four paragraphs about
  this for weeks and it did not occur to me that a *determinism* check needs it
  more than a sweep does: the frame loop advances the same world, by an amount
  that depends on how many frames the machine managed, and the feature under test
  costs frames. Both arms differed and it read as the tour moving the world.

Two rules fall out. **Instrument the disagreement rather than theorising about
it** — printing the samples around the spike answered in one run what three runs
of reasoning had not. And **distrust a new harness before you distrust rendered
code that has already been looked at.**

Four times before that the thing reporting the
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
