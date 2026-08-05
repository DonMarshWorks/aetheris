# Evolving formulas — design brief

Status: **built.** Record of a design discussion between Don and Claude, kept
current as the thing got made. Read it, and `plants-design.md`, before writing
any more of it.

Four of the decisions below were overturned by measurement once it ran. As in
`plants-design.md`, the wrong reasoning is kept and marked rather than quietly
rewritten — it is the most useful part of a document like this. They are
gathered under **What measurement overturned** at the end, and flagged where
they arise.

This replaces the scalar genome. Eleven floats per node bought real selection —
niches redistributing unbidden, lineages committing to the sea nobody told them
to take — but every lineage ends up much the same shape, because a number cannot
say *when*. A formula can.

## The target behavior

One plant, carrying **nursery nodes** that sit and reproduce and **scout nodes**
that shoot a vine out as fast as they can, with the difference decided by where
each node found itself when it was born. That is the whole point. If we cannot
see both kinds inside a single body, the system is not working, whatever the
diversity numbers say.

## What the program produces

One instruction list, several output registers, evaluated on two clocks. The
split matters and was nearly missed:

| output | evaluated | meaning |
|---|---|---|
| **capacity** | once, at birth, fixed for life | how many children this node may ever have, 1–5 |
| **spread** | once, at birth | how far its children are placed from it |
| **pace** | once, at birth | how fast it matures, paid for in lifespan |
| **vigour** | every time the node is considered | how badly it wants a child *now* |

Because the first three are fixed at birth, a body permanently records the
conditions it grew through — a node born in a good year is built differently from
its own child born in a bad one. Because vigour is re-read, it can depend on age:
rising as a node matures, or oscillating if age is fed through a sine, which is
where whorls and rhythmic branching come from.

**Vigour ranks nodes within one plant, not between plants.** It decides where a
body puts its next child — tips, base, or somewhere conditional — and nothing
else. A plant-wide multiplier on it would do nothing at all, since a uniform
factor cannot change which node is the maximum.

## The geometry, correctly this time

An earlier draft said 1–5 was what the geometry permits, citing six positions at
60° apart. **That was for `collide = 1.0`.** It is 0.72, and at that radius:

- a child at turn θ sits `2·d·cos(θ/2)` from its parent, so turns are legal out to
  **±138°**, not ±120°
- two children Δ apart are `2·d·sin(Δ/2)` from each other, so the minimum
  separation is **42°**, not 60°

That is a 276° arc at 42° spacing — room for **seven**. So **1–5 is a choice**,
comfortably inside what is legal, and the slot angles are free to be chosen for
how they look rather than forced.

**What that missed: exact slot angles build a lattice.** A heading is inherited
exactly and a slot angle is added exactly, so the angles close. Capacity 3 is the
commonest and its slots are 0 and ±90°, which is a square lattice; the planet came
out tiled with right-angled patches that read as circuitry, which is the one risk
`plants-design.md` names as bigger than anything in the evolution itself.

**A lattice is not the bug, though, and should not be designed out.** A three-child
plant *ought* to make a square lattice and a five-child one a hexagonal, and those
are efficient packings — that is the geometry being honest. What is wrong is a
*perfectly closed* lattice, because then every lineage packs identically and there
is nothing for selection to choose between. **About ten degrees of slop on the
slot angle** breaks the degeneracy and keeps the packing. Measured: niche evenness
0.83 at ±10°, against 0.71 at zero — and it falls back to 0.74 by ±29°, where the
packing itself is being lost. So the jitter is not decoration and not noise-for-
its-own-sake; it is the smallest perturbation that stops the tiling being
degenerate, and more of it is worse.

## Capacity, and what a slot is

**Mapped by squashing, never modulo.** `round(x) mod 5` is chaotic at the
boundary: 4.9 gives five slots and 5.1 gives one, so the smallest mutation turns a
branch hub into a vine segment — precisely the destructive-mutation failure a
fixed-length genome exists to prevent. Use
`1 + floor(4.999 * (tanh(x/4)*0.5 + 0.5))`.

**A slot is an angular position, not a counter**, measured from the heading the
node inherited:

| capacity | slots | habit |
|---|---|---|
| 1 | 0° | a vine, running straight |
| 2 | ±45° | a fork |
| 3 | 0, ±90° | axis plus a pair |
| 4 | ±36, ±108° | a split fan |
| 5 | 0, ±60, ±120° | a rosette |

When a node is picked and has unused slots, one is chosen at random from those
remaining. A slot blocked by a neighbor is simply not taken this time; the node
stays eligible and may be picked again later, by which time the obstruction may be
gone.

**Odd capacities keep the main axis, even ones split it.** That is deliberate
rather than an oversight. Committing the whole system to one habit — monopodial
like a tree, or dichotomous like many algae — would throw away a dimension.
Instead capacity itself carries the distinction, and a lineage wanting a
persistent trunk evolves odd capacities down it.

~~**Eligibility replaces failure counters.** A node is eligible while it has
unused slots and mature enough to use them; full nodes are done. Only a subset is
evaluated per cycle, so being passed over is not a penalty and no retirement
policy or arbitrary retry constant is needed.~~

**Measured, and it is wrong — this was the most expensive mistake in the brief.**
It assumes a blocked slot is a temporary accident. On a full planet it is not: an
interior node is boxed in by its own children and stays boxed in, so it never
fills, never leaves, and the frontier grows to **92–100% of all living nodes**.
That is not a frontier, it is area — and sampling from area is the exact failure
this project had already diagnosed and fixed once, where a body's draws land on
nodes that cannot grow and its growth decays as 1/r while its area grows as r².
The largest body on the planet fell from about 1,900 nodes to **42**.

A node now leaves after a single refusal, and one is the measured optimum rather
than a token — niche evenness falls monotonically as the allowance rises (0.77 at
one, 0.69 at two, 0.53 at three). But the instinct behind the claim was right
about *why* a node should be able to come back, so that is made real instead of
hoped for: **when a node dies, everything pressed against it is offered its place
again.** The obstruction genuinely is gone, and a death is an event already known,
so nothing has to scan for it. It costs about a fifth more wasted draws and buys
evenness 0.83 against 0.72. That is gap dynamics, and it is the best diversity
measured.

## pace — maturation, and the reason a node might not be reproducing yet

A node cannot bud until it has matured. Pace sets how long that takes and is paid
for in lifespan:

- maturation time scales as `mature × (1.6 − 1.2·pace)`
- lifespan scales as `fit × (1.40 − 0.80·pace)`

So a high-pace node is productive almost at once and short-lived; a low-pace node
spends a long time as structure before it contributes anything, and persists. That
is the scout and the nursery, and it is what gives a plant any notion of
*investment* — without it every node is productive from birth and nothing is ever
built.

It must be **per node**, not per plant. A body wants both kinds at once.

**Note on the old scalar `pace`:** it had only the cost, never the benefit. Nothing
anywhere bought growth with it. So when measurements showed it falling from 0.75
to 0.61 and this was written up as "weeds losing to persisters", that reading was
wrong — selection was simply deleting a penalty with nothing attached, which is
the only thing it could have done.

## spread — the distance to a child, not the width of a brush

The old scalar scaled the painted footprint and nothing else: a broad lineage
looked fatter, occupied no more ground, excluded nobody and paid nothing. It was a
skin.

**Spread now sets the step distance to each child.** The step is already computed
per bud, so this costs one multiply, and it makes breadth a real strategy: long
steps cover ground quickly but leave a loose body others can grow into; short
steps build a dense mat that resists invasion but claims territory slowly.

It also regulates itself. With the collision radius fixed, a short-stepping node's
outer slots stop fitting — at 0.7× step, turns past about 118° collide with the
parent. **Dense lineages lose the ability to branch widely, on their own.** Nobody
writes that rule.

Painted footprint scales with the step, so the picture stops lying about what is
claimed.

Per-node *collision* radii were considered and rejected: the spatial bins are
sized for one radius, and varying it means binning at the maximum and testing
per-pair. Not worth it when the step gives the same dimension free.

## Deleted

- **elong** — purely cosmetic, affecting only the drawn ellipse. Gone.
- **branch** — subsumed by capacity.
- **turn** and **wander** — directly contradicted by slots. The slot angles *are*
  the turn.

## Kept as it is

**The five affinities stay a normalized vector, not a formula.** The fixed budget
is load-bearing: it is what stops the drift to a bland immortal generalist, and
there are measurements showing what unconstrained affinity does. A formula output
cannot easily be budget-constrained across five values. It is also what color is
projected from, and that projection is what makes convergent evolution visible.

## The instruction set

A fixed-length list over a small bank of registers — linear GP, not expression
trees. No bloat by construction, point mutations stay small, and inactive
instructions drift neutrally into the raw material that makes a genome evolvable
rather than brittle.

| op | why it is here |
|---|---|
| `ADD` `SUB` `MUL` | linear combinations and products; the floor of any arithmetic |
| `DIV` (protected) | ratios — fit per unit depth, crowding per sibling. Protected, because this project has already lost four commits to a silent NaN |
| `MIN` `MAX` | thresholds and clamps without branching |
| `ABS` `NEG` | symmetry, and distance-from rather than signed difference |
| `SIN` | earns its place alone: age through a sine gives oscillation, and nothing else here produces rhythm cheaply |
| `TANH` | bounded squash, so a runaway product cannot swamp everything downstream |
| `CMP` | a < b ? 1 : 0 — the conditional, and the reason for doing any of this |
| `SEL` | c > 0 ? a : b, so a condition can choose a value rather than only report itself |
| `CONST` | evolved immediates |

**Deliberately excluded.** `EXP` and `POW` explode; `LOG` has a domain problem;
`MOD` is chaotic for the same reason it is wrong for the capacity mapping. And
**no random operator** — seed plus parameters must continue to determine a world
completely, because a link to a particular planet is a feature of the piece.

## Inputs

All scaled to roughly [-1, 1], so the genome need not discover units.

- **age** — the input that makes vigour worth re-evaluating at all
- **depth from root** — capacity falling with depth gives trees, rising gives
  explosive bushes, oscillating gives whorls. The most productive single input
- **fit** at this node, and the **five environment memberships**
- **latitude**
- **slots already used**, and the **parent's capacity** — so an architecture can
  inherit a rule rather than a value
- **local crowding** — living neighbors within a short radius
- a constant **1**

Later, once the rest works: the **environment gradient**, which would let a
lineage evolve to branch *toward* better ground rather than merely surviving where
it lands.

## Mutation

Point mutation on a randomly chosen instruction — its operator, one of its source
registers, or its immediate. Fixed length, so no bloat and no parsimony pressure
to tune. Minted where a branch forks and never per node, so a sector stays a
coherent unit for selection to act on.

## Observability — build this first, not last

A stale function shadowed its replacement for four commits of this project. It
returned NaN, `NaN|0` is `0`, and a `Math.max` downstream turned total failure
into a plausible constant. Fit-based selection was off the entire time, two
mechanisms were built on top of the bug, and confident explanations were written
for what the numbers were doing. Nothing threw. Nothing logged.

Small steps would not have caught that. A counter on the line would have caught it
in minutes. So, from the first commit:

- **output distributions** for every output — min, median, max, and the share of
  nodes landing on each capacity 1–5. A flat spread means the formula is ignoring
  its inputs; a single spike means it is a constant wearing a program's clothes
- **active instruction count** — how many instructions actually reach an output.
  If that is one, nothing is being computed, however long the program is
- **a non-finite counter**, expected to stay at zero and *checked* rather than
  assumed
- **input variance** — an input that never varies is not an input
- **the scout-and-nursery test** — the spread of pace and capacity *within* single
  bodies, not just across the population. Two plants each internally uniform look
  identical, by every population statistic, to one plant with both kinds of node
  inside it. Only the within-body spread tells them apart, and that is the thing
  this design exists to produce

## What measurement overturned

Everything below is from headless sweeps, each figure the mean of four seeds over
2,500 ticks at ×100 climate. `window.__world.plants()` returns all of it.

**1. The clamp on an instruction result is the most important dial in the genome,
and the brief never mentions it.** Outputs are read through `tanh(x/4)`, which
assumes `x` is of order one. Nothing made it so. Random programs with `MUL` in
them reach magnitudes around a thousand, `tanh` saturates, and **every output
becomes a step function of one sign bit** — the "constant wearing a program's
clothes" the observability section was written to catch, caught by exactly the
counter it asked for. Instruction results are now held to ±8.

**2. Vigour's within-body normalization is load-bearing, not bookkeeping.** The
brief says vigour ranks nodes within a plant and not plants against each other,
but the growth loop draws from one global frontier, so there was no within-plant
comparison to make. Scoring a candidate against its own body's running level is
what restores the property, and a uniform shift cannot move it — exactly as a
plant-wide multiplier cannot move a within-plant maximum. Measured, on evenness:
ranking vigour globally instead gives **0.47**, no tournament at all gives
**0.58**, and the within-body version **0.69–0.83**. Both halves earn their place.

**3. An array index is not an identity.** A freed slot is handed straight to the
next birth, so a stale frontier entry silently became a claim on whichever
stranger moved in: six draws in a hundred landed on a node that had not matured,
budding early and drawing twice as often as it should. Both the frontier and the
maturity queue now carry a generation with the index. The bug was found by
asserting that a metric which *must* be 1.000 was, and finding 0.94.

**4. The maturity gate needs a queue, or it wastes the draws it gates.** With the
gate but no queue, four draws in five hit a node too young to bud, and nine in ten
during colonization. A node's maturity date is known when it is born, so it is
bucketed by that date and spliced in when due — the same trick the death scheduler
already uses. Nothing is scanned.

**And the target behavior is present.** About a third of the variation in pace
and in capacity is *within* single bodies rather than between them, and **half of
all bodies carry more than one capacity**. Two plants each internally uniform
would score zero on that and identically on every population statistic. Roughly
6 instructions of 24 reach an output, the rest drifting neutrally — the productive
Cartesian-GP regime the brief asked for. A printed genome reads, for instance,
`vigour <- MUL(age, MAX(age, forest))`: a node that wants children more as it
matures, which is precisely what re-evaluating vigour was for.

## What the angles became, in three attempts

The slot table is gone. Capacity picked a row out of a fixed list of angles, so
there were five possible plant shapes and most nodes took the same one — which is
why the planet read as one organism repeated at different sizes. Don asked for the
angle to be evolved instead, and getting there took three goes:

1. **The genome names each child's heading outright.** The model we want, and it
   does not work. It is a **plateau, not a slope**: siblings must be about 45°
   apart to miss each other, so a genome that has half-discovered the trick —
   headings 10° apart — collides exactly as often as one that has not, and gains
   nothing. Measured: the mean turn between one child and the next sat at 0.17
   radians after nine thousand ticks and would not move. Neither a hotter mutation
   rate nor horizontal transfer rescued it. **No mutation rate fixes an absent
   gradient.**
2. **The index fans and the genome evolves the width.** Works, and looks
   geometric, because it forces equal spacing and perfect symmetry.
3. **A `slot` input.** The child's index, centered on the node's capacity and
   already scaled into the units the angle output is read in. Now `angle <- slot`
   is a *single output-address mutation* and yields a usable fan on its own, and
   everything past that is the genome's own business. The structural fan was
   deleted. Mean turn between siblings went 0.17 → 0.72 radians.

The lesson generalizes past angles: when a behavior will not evolve, ask whether
it is unreachable before assuming it is unwanted. The fix was not more search
pressure, it was putting the first working version one mutation away.

## Constants that quietly stopped being true

Both of these were measured optima when set, and both became wrong when something
else changed underneath them. Neither announced it.

- **`tries`, the retry allowance.** 1 was optimal when a fixed table decided
  angles — a retry then meant the same few directions and really was wasted. Once
  the genome chooses, a retry is a *different* angle, so cutting a node off after
  one refusal punishes precisely the experiment worth making. At 8: evenness
  0.56 → 0.78, plants of two minds 0.59 → 0.84.

  **Re-measured in the joint search, and 8 survives — but only past 20,000
  ticks.** At 20,000 a 2⁶ factorial made `tries = 2` look better on the
  composite, on within-body variety and on body size. At 45,000 it reverses and
  8 wins by 0.026. This constant is fine; the short measurement was not. It is
  the same mistake as the one below, one horizon further out.
- **`settle`, the grace before the fragment cull.** 400 was set when growth was
  efficient. Free angles waste far more buds, no founder could reach the threshold
  in time, and the planet went sterile. It took two isolation runs to find,
  because three changes had landed together. At 2000 every one of the twenty
  strategies stays occupied and mean fit nearly doubles. **One change at a time.**

## Affinity: modulated, not replaced — and what it actually does

Don's argument was that adjusting affinity is the only way a plant survives a
terrain change, and that one body ought to be able to specialize for more than one
terrain. Letting the formula *set* affinity outright is a trap: a node that can
read the ground and name its own affinity copies whatever it stands on, scores
maximum fit everywhere, and the niche structure dissolves into one immortal
generalist wearing local colors — the failure the fixed budget exists to prevent,
by a new road. So the program *modulates* a heritable vector, within a bounded
multiplier.

Measured at nine thousand ticks it looked like a triumph — evenness 0.42 → 0.71,
all twenty strategies occupied, specialization *up*. But two later measurements
qualify it badly, and both matter:

- **It is not sensing.** A node's own affinity fits its local ground better than
  its body's average affinity would by **0.01 against a mean fit of 2.4** — under
  one per cent. The within-plant color variation is real and two in five bodies
  do span two terrains, but that is **drift between mutated sectors, not terrain
  tracking**. Modulation is working as a source of affinity *variation*. The
  plants have the terrain inputs and are barely using them for this.
- **It may be feeding a monoculture.** Over 44,600 ticks niche evenness fell
  monotonically 0.75 → 0.30 while the largest lineage rose 0.15 → 0.63, with mean
  fit saturating near its ceiling and specialization climbing to 0.77. Being
  highly specialized *and* able to grow anywhere should be impossible — that
  trade-off is what held specialists and generalists in balance. This is the
  suspect, and it is under test.

**Nine thousand ticks is not long enough to judge an ecology.** It said modulation
was a triumph; forty thousand may say it is the disease.

**It did not. Modulation is exonerated, and it is load-bearing.** Measured in
the joint search at 45,000 ticks over five seeds, with `affmod` at 1.0, 1.3 and
2.2, the largest lineage's share is flat — 0.147, 0.140, 0.159 — so the
runaway is not a function of how far the formula may swing an affinity.
Turning modulation off altogether (`affmod = 1.0`) collapses specialization
0.61 → 0.32, drops mean fit 2.05 → 1.45 and loses one of the twenty strategies.
So it is not merely harmless, it is doing the work it was built for.

What the 44,600-tick collapse actually was is still open, but it is not this.
A candidate worth checking before anything else: with the ocean uniformly rich
the sea becomes a single undivided niche one lineage can hold, and that
condition alone produces evenness 0.42 against 0.92 and a largest lineage of
0.58 — which is close to the 0.63 that run reached. Whether that run in fact
had `marine` off has not been established; it is a hypothesis with a matching
signature, not a diagnosis.

## Open questions

- **Program length**, still. 24 instructions is what it was built with and has not
  been swept against 12 or 48. Same for the register and constant counts. The
  point of a fixed-length genome is that trying another is cheap — `#glen=48`.
- **Long runs erode it.** At 9,000 ticks rather than 2,500, evenness falls to 0.50,
  the largest body to 81 nodes, and the within-body spread of pace to 0.18. Some
  of that is the documented erosion of specialization under a moving climate, but
  the collapse in body size and within-body variety is not obviously the same
  thing and is the next thing to understand.
- ~~**Is the eligible set small enough?** The frontier currently saturates at
  130,000 entries and uniform sampling wastes most draws on nodes that cannot
  grow. Slot-eligibility and the maturity gate should shrink it a great deal, but
  that wants measuring rather than assuming.~~ **Answered, and the answer was no
  — they shrank it not at all.** See the strike-through under *Capacity, and what
  a slot is*. Retirement after one refusal plus readmission on a neighbor's death
  brings the frontier to about two thirds of living nodes, and bud success from
  0.31 to 0.47.
