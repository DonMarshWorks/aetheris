# Evolving plants — what measurement said

The companion to `plants-design.md`, which carries the design as it now
stands. This file carries the evidence: every claim this project made and then
tested, including the ones the testing destroyed.

It exists because the design document was becoming unreadable. Nearly every
section had grown a paragraph beginning "Measured, and it is wrong", and the
argument a reader needed — what the thing IS — was buried under the argument
about what it used to be. Splitting them keeps both usable. Nothing has been
deleted: the wrong turns are the most valuable part of the record, because the
ideas that failed here are exactly the ones that will occur to somebody again.

**Read this before trying something that sounds obvious.** Ocean nutrient
limitation was judged harmful twice and is now the default. Frequency
dependence was tried twice on two different questions and failed both. A
retry allowance measured optimal at 1, then at 8, and the constant did not
change — what changed was the code underneath it.

Four rules earned the hard way, all of them from this file:

- **One change at a time.** Two settled decisions were overturned because three
  changes landed together and the isolation runs came later.
- **A single seed varies more than the effects worth chasing.** Average four.
- **A short run judges nothing.** Nine thousand ticks called affinity
  modulation a triumph; forty-five thousand called `tries = 2` an improvement,
  and both were wrong at the horizon the piece actually runs.
- **Suspect the harness first.** Four times the thing reporting the
  measurement was wrong rather than the thing measured. See the last section.

---

## The central claim, and how much of it survived

The two ways this genre of simulation dies are **monoculture** (one lineage wins,
diversity goes to zero) and **frozen mosaic** (borders equilibrate and stop
moving). The usual remedies are artificial.

The climate genuinely wanders while the controller keeps every environment
*present* and merely relocates it, so a specialist tuned to today should be
maladapted before long and adaptation should never complete.

**Measured, and it is half right — in a way that took two attempts to see.**

The first attempt found no difference at all between a frozen planet and one run
at ×100, and this document briefly recorded the claim as false. That measurement
was worthless: a stale `fitAt` from the pre-genome code was still in the file and,
being the later function declaration, shadowed the genome one at every call site.
It read `sp.tlo` off a numeric offset, returned NaN, and `NaN|0` is `0`, so every
lifespan fell back on the `hostile` floor. **Fit-based selection was switched off
entirely**, and 99.7% of lifespan updates were NaN. Specialists never received the
longer life their specialism was supposed to buy, so of course specialization
drifted down whatever the climate did.

With selection actually working, specialization over fifteen thousand ticks:

| | start | mid | end |
|---|---|---|---|
| frozen planet | 0.470 | 0.486 | **0.507** |
| ×1 climate | 0.483 | 0.475 | **0.482** |
| ×100 climate | 0.396 | 0.363 | **0.350** |

And mean fit over the same runs: frozen 2.03 → 2.47, ×100 1.43 → 1.62.

So the thesis holds in its mechanism and fails in its conclusion. **Adaptation
genuinely never completes** — under drift, mean fit never catches up with a
population that is always chasing ground that has moved, which is exactly what
was claimed. But drift does **not** maintain specialization, it *suppresses* it:
a static world lets specialization climb, and ×100 grinds it down. Following a
niche that has moved means growing through country only a generalist can cross,
so drift is not neutral between the strategies — it favors breadth.

The instruction to lean on this "rather than adding artificial diversity
pressure" is therefore wrong about specialization. But see the next section
before concluding that anything needs fixing.

### Measured: what actually holds specialization up, and whether it matters

At ×100, over fifteen thousand ticks, against a baseline that falls 0.396 → 0.345:

| | end | change | mean fit | largest strategy |
|---|---|---|---|---|
| nothing | 0.345 | −0.051 | 1.62 | 0.255 |
| local kin, 0.5 | 0.344 | −0.048 | 1.71 | 0.258 |
| global rarity, 0.7 | 0.352 | −0.047 | 1.63 | **0.246** |
| dispersal ×7.5 | **0.360** | **−0.022** | **1.74** | 0.313 |
| dispersal ×30 | 0.351 | −0.025 | 1.34 | 0.253 |

**Frequency dependence does not touch specialization, and could not have.** It
acts on *which* strategy is common — global rarity is the only thing that pulls
the largest strategy's share down, 0.246 against 0.255 — and specialization is a
different axis entirely, being how committed a lineage is rather than which niche
it commits to. Both mechanisms work; neither answers this question.

**Dispersal halves the erosion**, and it is the only thing that does, because it
is the only one addressing the mechanism: a specialist cannot *walk* to ground
that has relocated, since the country in between suits only a generalist — but it
can be *thrown* there. It also gives the best mean fit of any run. More is not
better: at thirty times the baseline rate, fit collapses to 1.34 as spores land
faster than they can establish, and the body count doubles into debris.

**And the failure this was all guarding against is not happening.** The stated
failure mode is monoculture — one lineage wins and diversity goes to zero.
Nineteen to twenty distinct strategies stay occupied in every configuration
tested, and the largest never holds more than about a quarter of the population.
What declines under drift is the average *depth* of commitment, settling around
0.35, and on a world whose niches are permanently in motion that is arguably the
correct answer rather than a defect. Do not spend more effort forcing it up
without first deciding that a planet of moderate specialists is actually wrong.


---

## The joint search — twelve dials at once

Everything above was found by moving one dial. This section is what a search
over combinations found, and three of its results contradict things recorded
earlier in this document. The instruction that produced it was Don's: one at a
time gives wrong answers here, and there is a measured example — ocean nutrient
limitation was judged harmful twice in isolation and turned out to matter
enormously in company.

**Method, in four stages.** A randomised balanced screen of 56 configurations
over twelve factors, three seeds, 15,000 ecology ticks — every factor moving at
once, levels dealt out equally and shuffled independently, so main effects come
out near-orthogonal and interactions are covered at random rather than aliased
to a fixed pattern. Then two complete 2⁶ factorials, 64 cells each, where an
effect is a clean contrast and nothing is aliased. Then confirmation of the
finalists at 45,000 ticks and five seeds, a decomposition at eight seeds, and
long runs at 135,000. Roughly 700 headless runs. `tools/sweep.js`,
`tools/score.js`, `tools/analyze.js`, `tools/factorial.js`.

Three harness rules, each of which has already voided a round of measurement on
this project if broken: count **ecology** ticks and not climate updates, since
configurations with different `ecorate` reach a given number of generations at
different numbers of climate updates; retire the frame loop before measuring,
or it advances the same world by an amount no result records; and difference
the cumulative counters between readings, because `meanFit` is a lifetime
average and a single reading at the end of a long run is mostly a report on the
beginning of it.

### What won

Three parameters, all pushing the same way, and they are worth more than the
other nine together. Against the previous defaults at 45,000 ticks:

| | default | now | |
|---|---|---|---|
| `spore` | 0.006 | **0.001** | chance a bud is thrown clear to found a body |
| `minfrag` | 45 | **65** | nodes below which a severed piece is not viable |
| `settle` | 2000 | **1000** | grace before the fragment cull applies |

Mean plant **26.7 → 95.3 nodes**, plants holding more than one kind of node
**0.61 → 0.86**, largest lineage share 0.175 → 0.145, evenness 0.959 → 0.960,
mean fit 1.92 → 2.03. Sixteen seeds, all sixteen clearing every gate, all
twenty strategies occupied in every one. Nothing measured got worse.

Decomposed at eight seeds, `spore` alone is over half of it: dropping only the
spore rate takes the composite 0.702 → 0.758, only `minfrag` gives 0.720, only
`settle` 0.753, and all three 0.803.

**And an elaborate optimum lost to a simple one.** A ten-parameter
configuration tuned on the 2⁶ factorials scored 0.790 against these three
changes' 0.820. It was fitted to the 20,000-tick horizon rather than to the
ecology — see `tries` below.

### What actually interacts

**`marine`, `fitcap` and `rare` are substitutes, not complements.** This
contradicts the note under *Ideas not yet decided* below, which records the
three as jointly "the whole cure". Mean niche evenness over the eight corners:

| marine | fitcap | rare | evenness | mean fit | mean plant |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0.419 | 3.68 | 72.3 |
| 0 | 2.0 | 0 | 0.608 | 3.23 | 58.8 |
| 0 | 0 | 0.9 | 0.511 | 3.56 | 64.2 |
| 0 | 2.0 | 0.9 | 0.657 | 3.16 | 57.5 |
| **1.0** | 0 | 0 | **0.919** | 1.80 | 40.8 |
| 1.0 | 2.0 | 0.9 | 0.921 | 1.75 | 39.9 |

`marine` alone buys +0.500. Adding both others to it buys a further **+0.002**.
The three separately sum to +0.781 and jointly deliver +0.502. In the factorial
this shows as `fitcap`'s effect on evenness being +0.168 with marine off and
−0.000 with it on, and `rare`'s +0.070 and +0.003 — and `fitcap × rare` is
negative too, so even those two partly duplicate each other. The earlier verdict
that marine is harmful alone was almost certainly taken through the harness that
ran the ecology fifteen times too slowly, the same one already blamed for three
wrong readings on `rare`.

The default `marine = 1.00` is therefore right and stays. What is wrong is the
reason given for it. Its cost is real and large: it halves mean fit and cuts
mean plant size by a third.

### What surprised

**A short horizon reverses `tries`.** At 20,000 ticks `tries = 2` beat `8` on
the composite, on within-body variety and on body size. At 45,000 it reverses
and `8` wins by 0.026. `formula-design.md` records 8 as the measured optimum and
it is right; the 20,000-tick measurement is the misleading one. Nine thousand
ticks called affinity modulation a triumph, twenty thousand calls `tries = 2` an
improvement, and both are the same mistake.

**Affinity modulation is exonerated and load-bearing.** The suspicion recorded
in `formula-design.md` that it feeds a monoculture does not reproduce at 45,000
ticks: dominance is flat across `affmod` 1.0 / 1.3 / 2.2 (0.853 / 0.860 /
0.841). Turning it off collapses specialization 0.61 → 0.32, drops mean fit to
1.45, and loses a strategy. Leave it on.

**`ecorate` never bought anything by freezing, so the guard cost nothing.**
Holding ecology ticks constant makes simulated climate seconds run as
1/`ecorate`, so raising it buys a calmer planet — the degenerate win the search
had to refuse. It never materialised: at 45,000 ticks `ecorate` 12, 16, 24 and
32 all sit inside the noise across a 2.7× range of climate exposure. `ecorate`
can be chosen on frame-rate grounds.

**A frozen planet is still the most diverse, now measured properly.** At
135,000 ticks, across a 40× range of climate exposure — 0, 9.8, 19.7 and 39.4
simulated hours — evenness runs 0.985, 0.961, 0.975, 0.955 and mean fit 2.84,
2.20, 2.10, 1.86. More weather costs a little diversity and a lot of fit. This
confirms the `ecorate` note and contradicts this document's opening thesis: a
wandering climate is not what holds diversity up here. The niche structure and
the fit ceiling are. Note the frozen arm stops *everything* temporal, seasons
included — measured, the ice caps swing 6.9–10.3% at ×100 and are pinned to
7.38% frozen — so it is not a clean control for secular drift alone, and
separating seasons from drift would need a new dial.

### The spore, and what removing it does not do

`spore` is monotone downward all the way to zero, which is exactly the shape
that misleads at a boundary, so it was measured at the boundary. At 45,000
ticks: 0.002 → 0.808, 0.001 → 0.817, 0.0005 → 0.827, **0 → 0.837**. At 135,000,
zero still leads 0.841 to 0.800, with evenness **rising** 0.957 → 0.972 and all
twenty strategies occupied.

So "the spore is therefore not optional", recorded above under heartwood, is too
strong. That was written when heartwood had stopped fragmentation *as well*.
Wood rotting through still severs bodies into independent plants, and that is
strictly **local** — it founds new plants without moving anybody's genome across
the world. Remove only dispersal and reproduction is fine; 910 bodies persist
at 135,000 ticks with no spores at all.

It is set to 0.001 rather than 0 for a reason the score cannot see: an arrival
is meant to read as an event, and at zero there are no arrivals, only bodies
breaking apart where they already stand. 0.001 is inside a seed's noise of zero.

**Spores as experiments.** Don's proposal, built as `sporemut`, `sporefit` and
`sporeviable`. Mutating a spore harder than an ordinary bifurcation does not
help at a low rate (0.803 at ×8 against 0.814 at ×1) but clearly helps at the
old default rate of 0.006: 0.750 → 0.771, and 0.780 with the landing filter
relaxed too. So the intuition is right — heavy mutation offsets the homogenizing
cost of dispersal — but throwing fewer spores is a bigger lever and the two do
not stack. Restricting spores to fit nodes also helps (0.830 against 0.814), but
its mean plant size of 110 is almost exactly what plain `spore = 0.0005` gives
(109), so the evidence is equally consistent with it helping because it throws
**fewer** spores rather than better ones. Separating those needs matched
realized spore counts and has not been done.

### What the score got wrong

Recorded because the scoring was as much under test as the parameters.

- **The still-in-motion term measured the wrong thing and was most of the
  noise.** It was added to stop a search winning by becalming the climate.
  Strategy turnover measured *higher* at `ecorate` 32 than at 8 — the opposite —
  because a world that sees less weather keeps its lineages fitter and evolving
  faster. Meanwhile its seed sd was 0.208 against no other component above
  0.060, so at 0.20 weight it carried **84.5%** of the composite's variance.
  Cut to 0.08; the score's seed sd fell 0.047 → 0.011 and the ranking was
  unchanged at 0.20, 0.05 and 0.00. The freeze it was meant to catch is
  arithmetic, not statistical, and is bounded by the search instead.
- **Mean fit saturates for about a third of runs.** Kept deliberately — fit is a
  sufficiency check, and rewarding it without limit rewards exactly the runaway
  `fitcap` exists to prevent — but it means the score cannot rank the top of
  that range at all.
- **The score cannot see the thing that matters most.** The single most
  striking planet measured, `marine = 0`, has plants of 130 nodes and the
  clearest branching in any image, and it scores 0.603 because it is a sea
  monoculture with evenness 0.361 and still degenerating. High score and worth
  looking at are not the same axis, and only one of them is measurable here.

### And then the harness turned out to be lying

Everything above was measured through `tools/sweep.js`, and after it was all
written the harness was found to be non-deterministic. It stopped the frame
loop *after* waiting for the world to be ready, so an indeterminate number of
frames ran between boot and the stub, each advancing the world by a
wall-clock-dependent amount. Same seed, same parameters, slightly different
world; and two sweeps compared were two accidents compared. It now replaces
`requestAnimationFrame` before the page runs a line, letting through exactly
the one call that boots the world — the boot lives inside a frame callback and
schedules the loop as its last act — and dropping every call after it.
Verified identical across repeated runs.

This is the fourth time on this project that a measurement harness, rather than
the thing measured, was the thing that was wrong: the stale `fitAt`, the
one-step-per-climate-tick `runWorld`, the `runWorld` default that stopped
matching the frame loop, and now this. The pattern is worth naming. **A harness
is code that nobody tests, reporting on code that everybody tests.** The
counters that catch it are the ones that assert a thing which *must* be true —
that two identical runs are identical, that a metric which must be 1.000 is.

How much does it change? The effects reported above are far larger than the
drift — the three-parameter result is about 0.10 of composite score against a
seed sd of 0.011 — so the direction of every finding stands. The exact figures
carry a wobble they should not, and anything quoted to three decimals above is
really two.

A second and more embarrassing failure sits next to it. One seed went extinct
in a sweep and an *ad-hoc* analysis script averaged the corpse in as a zero,
which turned 81 occupied provinces into 62 and sent two hours into chasing a
build difference that was never there. `tools/score.js` refuses exactly this —
gate failures are reported as a rate and never folded into a mean — and the
script that got it wrong was one written in a hurry that bypassed it. **Do not
write a second analysis path.**

### Provinces: the diversity number that was missing

Every diversity measure here was global — niche evenness, largest lineage,
strategies occupied — and a global number cannot tell a planet of distinct
provinces from a planet uniformly mixed. Both have the same strategies present
in the same proportions. That is precisely the difference dispersal erases, so
it was precisely the thing that could not be seen.

`provinces()` cuts the sphere into equal-area boxes and compares the strategy
mixture between them. `differentiation` is the mean total-variation distance
between two boxes drawn at random: 0 means every province holds the same
mixture and geography has stopped meaning anything.

Measured, it says what Don predicted and what the global numbers could not:
**differentiation falls monotonically as the spore rate rises** — 0.716 at
0.001, 0.694 at 0.006, 0.616 at 0.030. Dispersal homogenises, and now there is
a number for it.

### Extinction is absorbing, and nothing in the old design could reverse it

Measured directly, on a planet started with no plants at all: with no
reseeding it sits at zero for thirty thousand ticks, **and so does a spore rate
of 0.001**. A spore is thrown *by* a plant, and fragmentation only divides
bodies that already exist, so before `reseed` there was nothing in the
simulation that could create a body not descended from the opening seeding.
There was no stop condition because there was nothing left to condition on.

`reseed` puts a founder with a fresh random genome into any province holding
almost nothing, on the cull pass. It brings the same dead planet back to 97,175
nodes across 71 provinces. That is a better argument for it than the diversity
one it was built for: it is the only thing that makes the world recoverable.

Two decisions in it are Don's and both are right. The founder's genome owes
nothing to any incumbent, which is what fills empty ground without spreading
whoever is winning — `seedmut` above zero makes it a heavily mutated copy
instead, for anyone who wants the opposite trade. And a seed is planted
**without regard to the ground**: it finds itself somewhere it can live or it
adapts. Refusing to plant on unsuitable terrain, which is what the first
version did, quietly made every founder a specialist for wherever it landed.

### The body signal: built, instrumented, measured, removed

Don asked whether nodes could coordinate — a tree that is attacked telling its
branches. The cheapest mechanism that could work is not messages but a **shared
input**: one float per body that any node may add to through an `emit` output
and any node may read as an input. No traversal, no per-node storage, and both
halves are one output-address mutation from existing, which is what decides
whether a behavior is reachable at all.

It was built, and it was never adopted. Genomes wired the signal into a live
output at 0.49–0.53 against a control whose register was **dead** at 0.53–0.56 —
indistinguishable, and not climbing. Don's own criticism of the combiner was
right in principle: a mean dilutes exactly the message worth sending, since one
node in distress among five hundred averages to nothing. Loudest-wins was built
and measured too. It made plants audibly louder — signal level 0.086 against
0.058 — and changed adoption not at all.

So the combiner was not the binding constraint. **Nothing here happens where a
node cannot see it.** A signal is only worth hearing when something occurs
somewhere you are not, and in this world nothing does; a node's own local
inputs already tell it everything that affects its prospects. It is removed
rather than left dormant, because an unused input still costs an address every
program can reference by accident. If herbivory or disturbance ever lands, the
mechanism is forty lines and the counters that judge it are in this section.

**A variant worth separating from that verdict: how happy is the plant.** Don's
later proposal is the mean fit of every node in the body, supplied as an input.
It looks like the signal above and it is not, in one way that may be the whole
difference: **the value is computed by the simulation rather than emitted by the
genome.** The removed version needed a lineage to evolve an emitter and a reader
together before either was worth anything, which is the plateau problem that
also killed genome-named child headings — no mutation rate fixes an absent
gradient. Here `vigour <- MUL(bodyfit, ...)` is one output-address mutation from
existing, which is the condition under which a behavior turned out to be
reachable at all.

It also answers the diagnosis on its own terms. A node at the center of a body
straddling a coastline knows its own fit and cannot know that half of its body
is drowning; that genuinely is something happening where it cannot see it. And
the behavior Don wants from it is legible — a well-suited body curling in and
shortening its steps, a badly-suited one throwing long scouts — which is exactly
the scout-and-nursery axis `formula-design.md` was built around, promoted from
within-body to whole-body.

Not built. Two things to know before building it. The counters already exist and
are in this section: adoption measured as the share of genomes wiring the input
into a live output, **against a control whose register is dead** — the control is
what turned the first attempt from a success into a null result. And the cost is
near zero if it rides the passes that already run: fit is re-estimated on a
rolling cursor and connected components are relabelled every `sweep` ticks, so a
running mean per root updates on machinery that is already paid for. Do not add
a scan.

## Sunlight as a pace: no effect where it was cheap, fatal where it was not

Axial tilt made the sun a real variable (`docs/world-controls.md`), so the
obvious next thing was Don's: give the genome the sun angle as an input, and
scale how fast a node lives by how much sun it stands in — floored above zero so
growth in the dark is slowed and never stopped, and with the **same** factor on
maturity and on lifespan, so a dark plant is slow rather than small and gets
through the same number of children in a longer life.

Built as `sunfx` (strength, 0 is off) and `sunlo` (the floor), plus a `sun`
input. Crossed with tilt, four seeds, 45,000 ticks:

| | score | live | bodies | mean body | evenness |
|---|---|---|---|---|---|
| off, tilt 24 | 0.811 | 111,601 | 1,219 | 94.2 | 0.948 |
| **on, tilt 24** | **0.812** | 108,733 | 1,095 | 101.6 | 0.941 |
| off, tilt 90 | 0.772 | 103,394 | 1,320 | 82.6 | 0.829 |
| **on, tilt 90** | **dead** | **0** | **0** | — | — |

**At the default tilt it does nothing at all** — 0.812 against 0.811, against a
seed sd of 0.015 — and the reason is worth keeping. At 24° insolation is
dominated by latitude, and `lat` is *already* an input. The sun input is very
nearly a linear function of something the genome could read anyway, so it
carries no information. Sun and latitude only come apart at high tilt, where the
poles are the warmest ground on the planet — and that is precisely where the
pace scaling killed the world.

**And the extinction is the `minfrag`/`settle` cliff for the third time.** With
`sunlo` at 0.15 a node in the dark takes 1/0.15 as long to mature: up to 960
ticks for its first bud, against the 1,000 ticks of grace a young body gets to
reach 65 nodes before the fragment cull applies. No founder can make it, every
new body is culled, and the planet ratchets to zero. This document already
records that cliff under dispersal, and `formula-design.md` records it again
under `settle` — **anything that slows growth walks into it**, and that is now
the pattern rather than the incident.

Two ways out, tested separately, and neither is good:

| | score | bodies | mean body | note |
|---|---|---|---|---|
| grace stretched to 6,700 | 0.585 | **17,235** | **6.7** | survives, shatters |
| floor raised to 0.40 | gated | 1,142 | 90.8 | 3 seeds of 4 |
| floor raised to 0.60 | gated | 1,282 | 87.9 | 3 seeds of 4 |

Stretching the grace by the same factor the maturity got trades extinction for
debris: at 6,700 ticks the cull barely applies, so every two-node scrap
survives and the mean plant falls from 82.6 to 6.7. Raising the floor gets three
seeds of four through and seed 31337 still dies — `score.js` gates the whole
configuration for it rather than averaging the corpse in, which is the behavior
it exists for.

**Verdict: the input stays, the pace scaling does not.** `sunfx` defaults to 0.
The `sun` input costs nothing measurable and is the thing a lineage needs before
phenology can evolve at all; the scaling is a liability that buys nothing where
it is safe and kills the world where it would matter.

**What this buys the energy model.** Don's better proposal — leaves accumulate
energy, a bud costs energy, and a bud attempt costs a unit of life, so "slow
plants live longer" emerges instead of being written down — walks into exactly
the same cliff, because it too slows growth in the dark. The measurement above
says what it needs in order not to: **count a young body's grace in bud
attempts, not in ticks.** That is the same change of currency the proposal
already makes for lifespan, applied to the one other place that measures a
plant's life in wall-clock ticks. A slow plant in the dark then gets the same
number of chances to prove itself, taken over more time — which is what "slowed
and never stopped" was supposed to mean in the first place.

## The frontier is not a perimeter, and an energy budget is the rule already running

`plants-design.md` justifies sampling the frontier on the grounds that "the
frontier *is* the perimeter — growth follows a body's number of tips, and per
unit area it still slows as 1/r". That was the argument for the rule and it is
**not true of the bodies this world actually grows.** Measured at 45,000 ticks
over four seeds (`tools/income.js`, `window.__world.bodyIncome()`):

| body size | bodies | living | frontier | wood | frontier / living |
|---|---|---|---|---|---|
| 8–16 | 47 | 10.4 | 7.4 | 0.0 | 0.707 |
| 64–128 | 976 | 97.3 | 83.7 | 14.6 | 0.860 |
| 128–256 | 1086 | 178.3 | 152.4 | 21.6 | 0.855 |
| 256–512 | 389 | 336.8 | 284.4 | 31.1 | 0.844 |
| 512–1024 | 39 | 607.1 | 513.1 | 54.2 | 0.845 |

**About 85% of a body's living nodes are on the frontier, at every size.** The
ratio is flat from 64 nodes to 1024 and if anything *rises* with size. So the
frontier is not a perimeter and growth does not slow as 1/r: a body's share of
attempts is very nearly proportional to its living node count. That is not new
behavior — `formula-design.md` already records retirement-after-one-refusal
plus readmission-on-a-neighbor's-death bringing the frontier to "about two
thirds of living nodes" — but the design brief's *justification* never caught up
with it.

Three consequences, and they change what the energy model is.

**An energy budget fed by leaves is the allocation rule already in force.**
Income proportional to living nodes and share-of-attempts proportional to
frontier entries differ by a constant of 0.85. So per-body energy budgeting is
not a change to the allocation rule — the lever `plants-design.md` calls the
biggest single one, with a scar to match — it is a re-parameterisation of it,
plus a seasonal term. That is a far smaller risk than it looked.

**Don's worry about a one-node founder is right, and it is already true.** A
founder holds one frontier entry against roughly 100,000; a 500-node incumbent
holds about 425. Founders are outcompeted on attempts by two to three orders of
magnitude *today*, which is why `settle` and `minfrag` exist as a grace at all
and why `reseed` was the only thing that could bring a dead planet back. A seed
energy store does not compensate for an asymmetry the energy model would
introduce; it fixes one that is already there.

**So the two proposals are not alternatives and the 2×2 is worth running.**
Grace counted in bud attempts rather than ticks removes an *artifact* — the cull
killing a slow founder before it has had a fair number of chances — and does
nothing to help it grow. A seed energy store is *substantive*: it gives a
founder real attempts it would not otherwise get. One is necessary, the other
changes who wins, and whether the second makes the first redundant is exactly
the question a crossed design answers and one-at-a-time does not. `marine`,
`fitcap` and `rare` are the standing example.

One design note with a documented reason behind it. A seed store makes founders
succeed, and founders arrive by two routes: `reseed`, a fresh random genome into
an empty province, and `spore`, a copy of something already winning thrown
across the world. This file records dispersal as a homogenizing force —
differentiation falls monotonically as the spore rate rises, 0.716 to 0.616 — so
a store that pays both equally spends part of its budget spreading the
incumbent. Paying `reseed` founders more than `spore` founders is the same trade
`seedmut` already makes, in a new place.

## The energy model — built, measured, and it earns its place

Don's design, and it supersedes the `sunfx` pace scaling above. A leaf gathers
energy from the sun it stands in and banks it; a bud attempt spends some; an
attempt also costs a little life. So "growth proportional to sunlight but never
zero" and "slower plants live longer" both fall out of one currency instead of
being written down as two formulas — the same move that made `pace` worth
having after the old scalar carried the cost and never the benefit.

Accrual is **lazy**: a node's store is brought up to date when it is drawn, from
the ticks since anyone last looked at it, so the mechanism costs nothing per
tick and nothing is scanned. The **attempt** is what costs, not the success — a
node that spends its store on a bud that collides has still spent it, which is
what makes a plant boxed in by neighbors exhaust itself rather than hammering
at the same wall for free.

**At the default tilt it is worth about two seed standard deviations**, and it
costs nothing in body size:

| | score | ±sd | evenness | turnover | mean body |
|---|---|---|---|---|---|
| energy on | **0.831** | 0.008 | 0.959 | **0.204** | 95.7 |
| energy + life cost | 0.821 | 0.011 | 0.958 | 0.169 | 95.0 |
| off | 0.813 | 0.010 | 0.956 | 0.167 | 94.7 |

Most of the gain is **turnover**, 0.167 → 0.204. A leaf that must save before it
can grow keeps the frontier churning where every mature tip previously budded
the moment it was drawn.

### Scarcity is the mechanism, and a bigger bank destroys it

`ecap` is how many buds' worth a leaf may hold. The prediction here was that 3
was too small to fund waiting out a season and that 8–20 would be better. It is
the opposite, monotonically:

| tilt 24 | score | turnover |
|---|---|---|
| cap 3 | **0.832** | **0.220** |
| cap 8 | 0.816 | 0.195 |
| cap 20 | 0.808 | 0.147 |
| *(off)* | *0.813* | *0.167* |

At 20 it scores **below the off baseline** on turnover. The energy model helps
because leaves are *often* short; a generous bank means a node is never
energy-limited, the gate stops biting, and what is left is the off condition
plus bookkeeping inertia. **Do not raise `ecap` to make waiting possible — the
waiting is the cost, not the feature.**

### The seed store beats the attempt grace, and they are substitutes

Both of Don's answers to the founder problem work, and the crossed design says
which. At tilt 90, where darkness makes growth slow:

| | score | all four seeds live? | mean body |
|---|---|---|---|
| off | gated | no — seed 7 dies | 79.5 |
| energy only | gated | no — two die | 79.1 |
| **energy + seed 400** | **0.761** | **yes** | **75.1** |
| energy + attempt grace | 0.742 | yes | 62.9 |
| energy + both | 0.740 | yes | 60.6 |
| energy + both, big seed | 0.731 | yes | 59.4 |

Both clear the extinction; the seed store does it **without shattering the
world** and scores higher. Combining them is worse than either alone — the
signature of substitutes over-correcting, exactly as `marine`/`fitcap`/`rare`.
At tilt 24 the asymmetry is sharper still: the store costs nothing (0.832,
top of the table) and the grace costs 0.053.

**The sizing rule falls out of why 40 failed and 400 worked.** At a bud success
of 0.12 an endowment of *E* funds about `E × 0.12` nodes: 40 buys five, invisible
against a viability threshold of 65; 400 buys about 48. So **`eseed ≈ minfrag /
budShare`**, around 540, and 400 is just under it.

### Two flaws the measurement found, both mine

**The cap ate the endowment.** `eseed` 40 and 400 produced *byte-identical*
worlds across sixteen runs — same score, same 109,286 live, same 1,194 bodies,
every digit. A tenfold parameter change cannot do that unless the parameter is
dead, and it was: the cap was written as a bound on what a node may *hold*
rather than on what sunlight may *bank*, so `accrue()` clamped a founder's 400
down to `ecap` the first time anything looked at it. Every seed-store number
taken before that fix was void. This is the fourth time on this project that a
parameter has provably done nothing, and the rule in CLAUDE.md caught it again:
instrument the line before theorising.

**The attempt grace fails in two opposite ways for one reason.** On its own, at
20, 40 and 80 attempts the planet goes **extinct** — a founder gets nowhere near
enough chances to clear `minfrag` before the bar reaches full strength. At 150 it
**shatters** into 5,323 bodies of 16.7 nodes — because a body that never attempts
anything never spends its grace and is spared for ever. A clock that only counts
chances cannot expire on a plant that has stopped taking them. The grace now
ends on whichever runs out first, chances or ticks, with the tick clock
deliberately generous: its job is to catch the stuck, not to hurry the slow.

## Moving plants — measured, and it is three orders of magnitude out

Don asked for heading and speed outputs, with nodes moving across the surface,
and named the risk himself: collision testing might be too expensive.

**It is, and not by a little.** Nodes are static today, so collision is tested
only where a bud is placed — a handful of candidates per plant per turn, about
nine bins each, which is why the whole thing is affordable. Moving nodes stops
the work scaling with the number of *plants* and starts it scaling with the
number of *nodes*, every one of which must be re-binned and re-tested every turn.

`overlapScan()` already performs exactly that pass over every seventh living
node, so it was timed rather than estimated (`tools/motioncost.js`). At 105,915
living nodes in 1,104 bodies:

| | |
|---|---|
| one 27-bin neighborhood pass over 1/7 of the population | 27.1 ms |
| extrapolated to every living node | **189 ms** |
| the ecology's entire per-frame budget | 4 ms |
| ecology steps the frame loop owes per second | 192 |
| cost of moving every node every step | **36 s of CPU per second** |

Thirty-six times the whole machine before anything is drawn, and one single pass
is forty-seven times the budget the entire ecology gets. Spread across frames it
would allow each node to be re-tested about four times a second — and that
budget is *already* spent, on growth. There is no version of this that is merely
tight.

**But the behavior it was wanted for is nearly free, and is already half
designed.** A body that grows on one side and dies on the other migrates without
anything moving, which is how clonal organisms actually travel; the fairy ring in
`plants-design.md` is that mechanism with no preferred direction. Give it a
direction and it is tropism. Both halves already run every tick — the frontier
chooses where growth goes, the death scheduler chooses what stops holding
ground — so the cost is the *input* that biases them, not a new pass.
`formula-design.md` already names it as the next input to add: the environment
gradient, "which would let a lineage evolve to branch *toward* better ground
rather than merely surviving where it lands." Paired with body fit above, that
is the unhappy plant shooting out scouts, and it costs a gradient lookup rather
than 189 ms.

---

## Two ideas that were decided, twice

Both of these sat under *Ideas not yet decided* in the design document for a
long time, each carrying a verdict that later measurement reversed. They are
here because a reader who trusted those verdicts would have thrown away the
default the piece now ships with.

### Ocean nutrient limitation — judged harmful twice, and it is the default

- ~~**The ocean is two-thirds of the arena and currently inert.** Including sea in
  the five affinities opens it up. The risk is that open ocean has no structure,
  so a marine specialist sweeps all of it — but the blurred distance-to-water
  field already used for continentality, *inverted*, gives coastal proximity. Use
  it as nutrient limitation and you get green fringes along every shore and blue
  deserts in the open gyres, which is why real ocean productivity looks the way it
  does.~~

  **Built as `marine`, measured, and switched off — it does the opposite.** The
  sea is indeed structureless and does hold the largest share of life. But
  starving the deep does not release the planet from it: it makes the open ocean a
  place only an extreme specialist can survive, and those are exactly the lineages
  that then hold all of it. Niche evenness fell 0.74 to 0.30 and mean fit to 0.88,
  with most of the world living on the hostile floor. The diagnosis was right and
  the remedy was backwards. Kept behind a parameter because the idea keeps
  recurring and now has a number attached.

- **Frequency dependence still answers a question nobody is asking.** Tried a
  second time, on niche balance rather than specialization, and it fails there
  too: evenness falls monotonically as `rare` rises, 0.82 to 0.72. It penalizes a
  common *strategy*, and a lineage can shift its specialization without changing
  which environment it favors, so it never pushes toward balance across the five.
  Two hypotheses, two failures. It should probably be deleted rather than tried a
  third time.

**And that verdict was wrong too.** It was taken in isolation, and the joint
search found `marine` to be the single largest lever in the whole parameter
space: alone it buys +0.500 of niche evenness, taking the sea from one
undivided niche that a single lineage can hold to a structured one. `marine =
1.00` has been the default since. The cost is real and worth knowing — it
halves mean fit and cuts mean plant size by a third — but the trade is
strongly worth making.

Three verdicts on one parameter, each confidently recorded: harmful, harmful,
essential. What changed was never the parameter. The first two readings were
taken one dial at a time, and at least one of them came through the harness
that ran the ecology fifteen times too slowly against the climate.

### Frequency dependence — not useless, redundant

The entry above concluded `rare` "should probably be deleted rather than tried
a third time". The joint search says something more precise and more useful:
it is a **substitute** for ocean nutrient limitation, not a failure. Its effect
on evenness is +0.070 when `marine` is off and +0.003 when it is on. Both
mechanisms break up the same monopoly, so with the stronger one running the
weaker has nothing left to do.

That is why testing one dial at a time found nothing here. A substitute
measures as useless whenever its partner is present, and as valuable whenever
it is absent, and neither reading is the truth about it.
