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
- **Deploy.** Work on `main` and push; GitHub Pages serves it directly. The
  `plants` branch is merged and done, and the detached-worktree dance that used
  to publish it is retired — it existed only to keep `main` and `plants` from
  ever touching, and there is no longer a second branch to keep apart.

  Keep `preview/index.html` byte-identical to `index.html` when you change
  either.

  `npm run verify` must be green on the exact `index.html` being pushed — check
  the blob hash matches rather than assuming, since it takes about twelve minutes
  and it is easy to edit the file while it runs.

  Do not put "now running verify" in the last sentence of a message. Twice the
  sentence stood in for the action and the gate never ran: writing the intent
  discharges it, and a reply arriving before the next turn removes the only
  chance to notice. The call goes in the *same* message as the claim.

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
passed through the world's center; off-axis it must add the angle between them.
And the tour draws from `Math.random` and **never `prnd()`** — a camera reaching
into the simulation's stream would make the route decide the planet.
`tools/tour.js` asserts two identical runs, one touring and one not, produce
byte-identical ecologies.

**Test hooks.** `window.__world` exposes `S` (state), `F` (the fields),
`advance()`, `runWorld()`, `freeze()`, `setView()`, `sunDir()`, `cam()`,
`pole()`, `ringPoint()`, `pins()`, `tour()`, `setTour()`, `tourGo()`,
`pointerCount()`, `debug()`, `params()`, `defaults()`, `settings()`,
`holdClimate()`, `instHash()`, `buildMs()`, and the plant hooks in
`plants-design.md`. Used by `verify.js`, `sweep.js`, `controls.js` and
`linkcheck.js`. Keep them working.
`holdClimate()` pins the three dials so the world can be asked where it
settles, which is the one question a controller steering toward a target can
never answer about itself.
`instHash()` rebuilds the plant sheet's instance buffer and hashes it, and
`buildMs()` times the rebuild alone. They exist as a pair: an optimisation of
the rebuild is only allowed to make `buildMs` smaller, and `instHash` is how you
say it did nothing else. Both are useless without the rAF stub below.

**Any probe that runs the world must stub `requestAnimationFrame` first.** The
frame loop advances the same world `runWorld` advances, by an amount that
depends on how many frames the machine managed — so two runs of *the same file*
returned 80,739, then 81,373, then 84,121 live nodes. Let through exactly the
first rAF call (the boot lives inside one and schedules the loop as its last
act) and drop every call after; `tools/tour.js` has the recipe. Assert the probe
agrees with itself before you let it compare anything.

**The `#perf=1` overlay** breaks a frame into sim / eco / sheet / draw / other,
with the rebuild split again into ghost / sort / emit and build / upload / draw /
mipmap. Read `mean/worst`, never the mean alone — see the lesson below.

## Hard-won lessons

Every one of these was a real bug that shipped and had to be diagnosed. They are
easy to reintroduce.

**Performance**

- **A governor cannot correct an error it cannot see.** `dt` is clamped to 0.25s
  so a backgrounded tab cannot hand the climate an hour in one step. The frame
  rate was then computed as frames ÷ the sum of those *clamped* values — so it
  could not report anything worse than **4.0** however slowly the machine was
  going. A Fire TV at well under one frame a second read 4.0, and the adaptive
  resolution and the plant sheet's rate limit both believed it. The tell was a
  user saying "fps 4.0, but no way, it is actually less than 1". Measure the
  frame rate on the wall clock, and keep it separate from whatever the
  simulation is allowed to integrate.
- **A mean over a window that may or may not contain the expensive event is a
  coin toss, not a measurement.** The sheet rebuilds about once a second and the
  sampling window is about a second. The first reading said `sheet 1.4ms`, and
  that was written into a commit message as evidence the cost was elsewhere; the
  second said `300`. Both were true of their own window and neither was true of
  the frame. Report worst-in-window alongside the mean, and count how many of the
  event the window actually saw.
- **`other` clamped at zero is not evidence of nothing.** The overlay's
  unaccounted-time column is `max(0, frameTime − Σphases)`. Once the accounted
  phases exceed the frame time it reads 0, which looks like "no GPU wait" and
  actually means the accounting has saturated.
- **Look for a constant being recomputed before you look for work to skip.**
  The rebuild cost 59ms and it was all in the emit loop, so the plan was to cull
  the far hemisphere — real work, real staleness, real risk to the picture. But
  `emitNode` was calling `asin`, two `atan2`, two `sin` and two `cos` per node
  per pass to find where the node sits on the sheet and which way its leaf lies,
  and *a node never moves*: `NPX/NPY/NPZ` and `NHX/NHY/NHZ` are written in one
  place, in `addNode`, and never again. Fourteen transcendentals a node, 1.3
  million a rebuild, all recomputing what was decided at birth. Moving them to
  `addNode` as `NU/NV/NROT/NSU/NSV` — plus reusing the paint between a node's
  two passes — took the rebuild **59.4ms → 13.8ms, 4.31×, byte-identical**. Grep
  the hot loop for what its inputs are before designing around its cost.
- **Cache from the stored value, not from the argument.** The first version of
  that cache computed from `addNode`'s float64 parameters; the loop it replaced
  read `NPX[i]`/`NHX[i]`, which are `Float32Array`. One rounding earlier, and
  every instance moved in its last bit. The world was identical, the instance
  count was identical, and the buffer hash was not — which is the only reason it
  was caught, and is why `instHash()` exists.
- **Isolate passes one at a time; do not reason about where the pixels go.**
  Chasing a Fire TV down to 5fps, four theories were formed and *four were
  wrong*: the sheet was cheap (a sampling window that missed the rebuild), the
  device was software-rendering (a PowerVR — `px/ms` looked identical to
  SwiftShader and meant nothing), `minres` was the answer (at 81k pixels there
  was nothing left to take), and the background's full-screen overdraw was
  costing something (it measured zero). What actually found it was `noplanet` /
  `nobg` / `noclouds` / `noatmo` / `noring`, one per load: **the clouds were 41%
  of all pixel work** while running eight noise evaluations a pixel against the
  planet's twenty-nine. Two passes over the same disc, and the smaller one cost
  nearly as much as the larger. Every switch that killed a theory cost minutes;
  every theory acted on would have cost hours.
- **A `discard` is not free on a tile-based renderer** — but that was a fifth
  theory and it was also wrong. Testing it needs the instruction ABSENT at
  compile time rather than unreached, because the driver reacts to it existing
  at all; a runtime branch around it proves nothing. Compiling the shader both
  ways measured no difference.
- **Smoothness is spreading the work, not reducing it.** "Two frames fast, one
  slow" at 100k nodes was the sheet rebuild landing every third frame and
  costing 326ms. The fix removed no work at all: `beginInstances` /
  `stepInstances` pay it a fifth of a frame at a time and swap the buffer only
  when a whole one is finished. The rate limit then stops applying — `sheetGap`
  existed to protect the frame by skipping rebuilds, and a bounded cost every
  frame reaches the same freshness without the stall. Stop on a **lineage**
  boundary: the paint cache and branch-before-leaf order are per node, but the
  depth order is per lineage.
- **The eye's clock is not the simulation's.** `dt` is clamped at 0.25s to
  protect the climate, and the daily spin and every camera ease were riding on
  that same clamped value — so past 4fps a 600ms frame turned the planet by
  250ms worth and the 150ms frame after it turned it by 150, and the ground
  moved at a rate unrelated to the clock. Uneven frames look like uneven frames;
  uneven frames carrying uneven amounts of rotation look broken. `viewDt` is the
  real elapsed time with a one-second ceiling. The comment at the sunlight model
  already promised the spin "advances on wall-clock time"; the clamp had been
  quietly making that untrue on exactly the machines that needed it.
- **A quality reduction is the author's call, not the profiler's.** The finest
  surface octaves cost 60ms and 40% of the frame rate on that hardware. Rather
  than decide, they were put behind `fine` so the trade could be *looked at* —
  and the answer, "I'm not sure about the difference", is what made dropping
  them automatic below 20fps. The same applies to `cloudres`. Measure the cost;
  ask about the worth.
- **Half resolution is for diffuse things only.** It works on the cloud deck
  because weather has no edge to lose; it would not work on coastlines, and it
  does not work on small leaves either. Individually a leaf at that range is
  sub-pixel, but collectively the small leaves *are* the colour of the ground
  cover — dropping them does not remove detail nobody can see, it thins
  something everybody can.
- **A cull is only as safe as the refresh behind it.** Skipping the hidden
  hemisphere from the sheet costs 50% of the instances and is invisible — but
  only because the rebuild is now continuous, so ground coming round the limb
  has had ~37 rebuilds since it was hidden and arrives at most 2.4° late, at the
  limb, where foreshortening hides it. Under the old 900ms rate limit the same
  cull would have been a visible band of missing plants. The optimisation was
  bought by the one before it.
- **Turning the eye into the model's frame beats turning the model into the
  eye's.** One transpose per rebuild against one dot product per node. `rot3`
  is **column-major**, so its transpose reads across the ROWS — get it backwards
  and you have a perfectly good rotation that culls the hemisphere being looked
  at, and nothing anywhere throws. Same shape as the `qFromBasis` trap. The
  check has to be a picture.

**Measuring any of this**

Six separate times in one day the harness was wrong rather than the thing
measured. Every one is cheap to repeat:

- **The frame loop advances the world.** Two arms that saw different numbers of
  frames are not the same world — the continents have moved. Meter
  `requestAnimationFrame`: one call boots the page, every frame after is handed
  out deliberately. Without it a "cloud resolution" comparison read 4.78/255 and
  half of it was terrain.
- **`setSpeed(0)` stops the climate, not the ecology.** `plantDebt` goes on
  being paid down against a wall-clock budget every frame, so a paused-looking
  world still grows plants at a machine-dependent rate. Press the actual pause.
- **Pin every knob that adapts before testing one that does not.** `fine`,
  `cloudres` and `cull` all switch on frame-rate thresholds, so two arms cross
  them at different moments. A cull comparison read 21% and the difference was
  the weather.
- Plus the three above: a mean over a window that may not contain the event, a
  frame rate that cannot report below its own clamp, and an unaccounted-time
  column that saturates at zero.

Against those six, **four theories about where the time was going were wrong**:
the sheet was cheap, the device was software-rendering, `minres` was the answer,
and the background's overdraw was costing something. Both real findings came
from the same two moves — grep the hot loop for what it recomputes, and turn
passes off one at a time. Neither came from thinking about it.

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
- `smoothstep(a, b, x)` with `a > b` is **undefined behavior**, not a reversed
  ramp. Always ascending; use `1.0 - smoothstep(lo, hi, x)` to descend. Symptom:
  the feature silently vanishes on some drivers (this hid the entire starfield).
  `verify.js` scans for this statically.
- Noise gradient vectors must be **normalized to unit length**. Unnormalised
  hashes bias toward cube diagonals and produce a herringbone lattice.
- **Never finite-difference the interpolated grid.** Smoothstep-bilinear has a
  gradient of exactly zero on every cell boundary, so differencing it beats
  against the grid and draws stripes across mountain belts. Use `heightCR()`,
  which returns value and both derivatives from one 4×4 neighborhood.
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
  a 6,370 km radius; ranges read by *snow and rock color*, not shadow. Anything
  stronger looks like a rendering bug.
- The **terminator is driven by the geometric normal**, never the bumped one.
  With the sun near-tangent, small relief tilts throw whole regions into shadow
  and the coarse grid shows through as blotches. `reliefMix` fades relief in as
  the sun climbs.
- **Clamp elevation at sea level before differentiating**, or the continental
  shelf drop reads as a cliff and every coastline throws a shadow.
- **Barren ground color must depend on temperature.** Cold desert is gray-brown
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
- **Never empty a scroll container to rebuild it.** `buildSettings()` began with
  `setList.textContent = ""`, and `#setlist` carries
  `-webkit-overflow-scrolling: touch`. On iOS that collapses `scrollHeight` to
  zero and takes `scrollTop` with it: scroll down to a control, tap its pin, and
  the list jumps to the top, so the second tap lands on a different card. It
  presented as "you can't disable a pin once you have enabled it", *and only on
  the settings page* — the copy on the world view is not inside a scroller.
  Update in place (`syncPinButtons`); rebuilding eighteen cards of sliders
  because one boolean changed was wrong anyway.

  Two things about how that was found, because both will recur. **It does not
  reproduce in Chromium**, which restores scroll position across a content swap
  where iOS Safari's momentum scroller does not — so the emulated test reporting
  "the list held its place" was true and worthless. And the first diagnosis was
  wrong: the pin is a 22px target where Apple asks 44, which is a real defect and
  was fixed, but it was not this one. What killed that theory was the observation
  that the *same button at the same size* worked on the world view and not in the
  panel. **When two instances of one control disagree, the difference is not in
  the control.**

## Style

**American spelling throughout** — the about panel, the settings and graph
cards, button labels, the README and these documents. Code comments inside
`index.html` are the one place still written British-ish, and only because
nobody has swept them; match the file you are editing. Comments explain *why*
not *what*. The HUD states
the three time scales explicitly (a day 2.5 min, a year 15 min, continents
~40 min) rather than inventing a single geological clock, because those are
compressed by factors differing by nine orders of magnitude and any one counter
would contradict the others. Erosion and real plate tectonics are **not**
modeled — don't claim otherwise in the README.

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
