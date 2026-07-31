# Evolving plants — design brief

Status: **stages 0, 1 and 3 built and running on the `plants` branch.** This is
the record of a design discussion between Don and Claude, kept current as the
thing gets made. Read it before writing any more of it.

Much of what follows was argued from first principles and then measured. Where
a measurement contradicted the argument, the measurement is recorded and the
argument is struck out rather than quietly rewritten — the wrong turns are the
most useful part of a document like this.

This revision replaces an earlier model in which the unit of occupancy was a
grid cell and plants were area-filling plates, the visual reference being
crustose lichen. The model is now **branching growth in continuous position**:
nodes, parents, headings, collision. Most of the ecology survived that change
untouched; the parts that did not are called out where they arise, because they
were load-bearing on the old model and their replacements are not obvious.

## The goal

The planet becomes an arena for competing plants that consume area no other
plant can occupy. Growth is governed by **evolving algorithms** — genetic, not
neural — so lineages adapt both to environments and to each other's strategies.
Plants are enormous on a planetary scale.

## What makes this planet a good arena

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
longer life their specialism was supposed to buy, so of course specialisation
drifted down whatever the climate did.

With selection actually working, specialisation over fifteen thousand ticks:

| | start | mid | end |
|---|---|---|---|
| frozen planet | 0.470 | 0.486 | **0.507** |
| ×1 climate | 0.483 | 0.475 | **0.482** |
| ×100 climate | 0.396 | 0.363 | **0.350** |

And mean fit over the same runs: frozen 2.03 → 2.47, ×100 1.43 → 1.62.

So the thesis holds in its mechanism and fails in its conclusion. **Adaptation
genuinely never completes** — under drift, mean fit never catches up with a
population that is always chasing ground that has moved, which is exactly what
was claimed. But drift does **not** maintain specialisation, it *suppresses* it:
a static world lets specialisation climb, and ×100 grinds it down. Following a
niche that has moved means growing through country only a generalist can cross,
so drift is not neutral between the strategies — it favours breadth.

The instruction to lean on this "rather than adding artificial diversity
pressure" is therefore wrong about specialisation. But see the next section
before concluding that anything needs fixing.

### Measured: what actually holds specialisation up, and whether it matters

At ×100, over fifteen thousand ticks, against a baseline that falls 0.396 → 0.345:

| | end | change | mean fit | largest strategy |
|---|---|---|---|---|
| nothing | 0.345 | −0.051 | 1.62 | 0.255 |
| local kin, 0.5 | 0.344 | −0.048 | 1.71 | 0.258 |
| global rarity, 0.7 | 0.352 | −0.047 | 1.63 | **0.246** |
| dispersal ×7.5 | **0.360** | **−0.022** | **1.74** | 0.313 |
| dispersal ×30 | 0.351 | −0.025 | 1.34 | 0.253 |

**Frequency dependence does not touch specialisation, and could not have.** It
acts on *which* strategy is common — global rarity is the only thing that pulls
the largest strategy's share down, 0.246 against 0.255 — and specialisation is a
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

## The model

### Turns

Plants take turns. In each turn, for each plant:

1. **Death.** Any node whose age exceeds the maximum allowed for the environment
   it actually sits in is killed and removed from its parent's child list.
   Evaluation continues into its children regardless.
2. **Severance.** Each surviving subtree that has been cut loose becomes an
   independent plant, added to the list evaluated in subsequent turns.
3. **Growth.** Up to 8 candidate nodes are chosen. Each evaluates a formula
   returning how badly it wants to bud; the highest wins. The winner evaluates a
   second formula giving a turn angle, which is added to the heading it inherited
   from its own parent, so a formula returning a constant 0 grows in a straight
   line. If the new position would collide with any node — its own plant's or
   another's — the request is refused and the plant loses the turn. The very
   first node of a plant takes a random heading whatever its formula says.

One bud per plant per turn. This bounds work per turn by *plant count* rather
than node count, which is what makes the whole thing affordable.

### Nodes, lifespan, fragmentation  (Don's design — adopted)

- Each node carries **five formulas** giving its affinity for each environment,
  **including sea**.
- A node's **lifespan is derived from its affinity for where it actually sits.**
  Not a gene. This is important: a lifespan gene under selection just ratchets
  toward immortality and needs an artificial cap, whereas deriving it from fit
  means the body's persistence is sculpted by terrain automatically — a lineage's
  shape hugs the ground that suits it with no code that says so.
- **All nodes die eventually.**
- When a node dies and severs a body, each separated part **becomes an
  independent plant**. Advancing sea or ice cuts plants not suited to them.

Fragmentation makes individuality *emergent* rather than declared, gives
vegetative reproduction (how real clonal plants, corals and lichens actually
propagate), and turns climate change into **allopatric speciation** — a sea-level
rise that cuts a landmass literally cuts a lineage in two and they diverge. That
is the existing climate system acting as a speciation engine, for free.

### The root dies first — and that is the life cycle, not a bug

Lifespan derives from fit, age accumulates, and the oldest nodes are the ones
nearest the root. So a plant is repeatedly **decapitated from the centre
outward**: grow, hollow out, break into an expanding ring of independent
fragments. That is a fairy ring, and it is what aspen clones, corals and crustose
lichens actually do.

Two consequences. Per-plant state must be **cheap to create**, because plant
objects churn constantly. And identity for colour must be **genomic, never
per-plant** — a per-plant palette would strobe.

**Measured, and it was not the fairy ring.** On a *frozen* planet — the growth
hook never advances the climate, so terrain was never a factor — the largest body
on the whole world was 93 nodes out of 81,552. A fifth of all deaths had two or
more living children and truly split a body; splits never reverse; a body of S
nodes takes about 0.2·S of them over its own lifetime. Small bodies were
arithmetic, not a bug, and not the terrain.

Two proposals died on the way to the fix. **Merging** touching lineages was
rejected: it makes identity ambiguous and root and branch management messy for
no gain we needed. **Reparenting an orphan to its grandparent** was measured and
abandoned: of the deaths that severed, the parent was already dead 78% of the
time, because deaths run in birth order down the chain. There is usually no live
grandparent to reparent to.

**What worked: heartwood.** A node that dies still holding children stops
growing, stops counting as alive, and stays in the tree as structure — dead in a
real trunk too, and still holding the tree up. It is released when its last child
goes. Ageing then stops splitting anything, and mean body size went from 10.7 to
508.

### The geometry has already decided several things

With step distance `d` and collision radius `r_c`, these follow and are worth
knowing before tuning anything.

- **Turn angles are usable only to about ±120°, not ±180°.** A child turning by θ
  lands `2·d·cos(θ/2)` from its parent, so with `r_c = d` anything beyond 120°
  collides with the parent. Squash formula output into roughly ±90° or most
  mutations produce a wasted turn.
- **A node can have at most 5 children, not 8.** Children sit on a circle of
  radius `d` and must stay `r_c` apart; with `r_c = d` that is 60° apart, so six
  slots, one of which is the parent. The child cap and the collision radius are
  the same parameter wearing two hats. For 8 children to be reachable, `r_c` must
  be about `0.68·d` or less.
- **Plants never fight; they only outlive each other.** A blocked bud simply
  loses its turn and nothing ever displaces an occupant, so borders freeze on
  contact and move only when something dies. This is the intended answer to the
  contest question, but it makes gap-filling a race — so **randomise plant turn
  order every tick**, or list position decides who wins.

### Three things heartwood then exposed, in order

**Fragmentation was reproduction.** With nothing splitting, nothing founded new
bodies either, the fragment cull became a one-way ratchet, and the planet went
extinct by tick 6,000. The spore in the dispersal section below is therefore not
optional, and a newly founded body — one node — must be spared the cull until it
has had time to establish.

**Wood was holding ground it had no business holding.** Left in the collision
bins it walled off 42% of the planet against the very plants that made it, and a
body could never grow back through its own dead interior, which is exactly what a
crust does. Letting living growth pass through wood took mean body size from 30
to 68 and the largest from 389 to 892.

**Wood is unbounded.** It is released only from the tips inward while growth runs
outward, so it climbed to 96,010 of 130,000 slots and squeezed the living out —
population fell through 47,000 and kept going. It now has its own clock: when it
**rots through**, whatever it was holding becomes a body in its own right. So
decay fragments a plant, at a rate we choose, rather than ageing doing it at a
rate we do not. `rot` is the dial, and it is a straight trade — no decay gives
bodies of 892 and a dying population; 900 ticks gives a stable 93,900 and bodies
of 62.

### Frontier, not area — this is the biggest single lever

Candidate nodes must be drawn from a maintained **frontier set**, not from all
nodes with spare child slots. Sampling from area, a large compact plant draws
interior nodes that are boxed in, wastes the turn, and its growth rate decays as
roughly `frontier/area ~ 1/r` while its area grows as `r²`. Plants therefore
stall at a size set implicitly by the sampling rule.

That may be a perfectly good size cap. It must be a **decision**, because it is
the parameter that determines whether the planet ends up carrying a few giants or
thousands of small things.

Related: with one bud per plant per turn, two 500-node plants grow twice as fast
as one 1000-node plant. Selection will notice, and fragmentation becomes the
dominant reproductive strategy. Expect drift toward small bodies, and put a floor
under it — a fragment with no viable frontier and fewer than a few nodes should
simply die, or the plant list fills with debris that costs bookkeeping and
poisons the diversity metric.

**And the allocation rule matters more than expected.** Drawing attempts from one
*global* frontier makes a lineage's growth compound on whatever it already holds:
the marine form's bud success rate was the second best of five, and it simply got
ten times fewer attempts. The opening seeding lottery had decided the shares and
nothing could recover from them — 0.85 sr of perfectly good shelf sat 93% empty.
Seed each strategy deliberately rather than by lottery. Strict one-bud-per-body
turned out to be the wrong correction once heartwood stopped fragmentation: forty
plants taking one node a turn cannot fill a planet. Sampling the frontier is the
fair rule, because the frontier *is* the perimeter — growth follows a body's
number of tips, and per unit area it still slows as 1/r.

## The genome

### Built: eleven numbers, not a program — yet

Numbers before programs. Eleven floats per node, copied whole into a first child
and mutated into a second or later one, is enough for real selection, and if
lineages will not differentiate on eleven floats they will not differentiate on
sixty instructions either — it will only be far harder to see why.

- **five affinities**, for the five environments the climate controller already
  holds in balance: sea, ice, desert, grass, forest. That choice is the whole
  argument for this planet as an arena — the controller guarantees each of the
  five continues to exist and merely moves it, so a specialist for any one of
  them always has somewhere to live, and never has it for long.
- **pace**, which was supposed to buy growth with lifespan and in fact only ever
  charged the lifespan — see `formula-design.md`
- **branch, turn, wander** — behaviour
- **spread, elongation** — morphology, and both purely cosmetic: neither ever
  touched the collision radius, so a broad lineage looked broad and claimed
  nothing

All six of those are superseded by `formula-design.md`. The five affinities stay.

Fit is the affinities against a soft membership of where a node stands, summing
to one so there are no hard biome edges for a genome to snap against. Lifespan
reads straight off fit and is never itself a gene.

**It selects.** Over thirteen thousand ticks pace fell from 0.75 to 0.61 — weeds
losing to persisters — while lineages committed to forest went from 665 nodes to
4,559 and grass halved. Nothing wrote that.

**And specialisation drifts down**, 0.42 to 0.32. The fixed budget stops affinity
*inflating* but nothing stops it *flattening*: a generalist scores one everywhere
and can grow anywhere, while a specialist scores five in one place and cannot
leave it, and on a world with this much edge breadth wins. See the open question
on frequency dependence.

The instruction genome comes when there is something to condition on — turn
harder when old, lean toward moisture, branch more when crowded. That is when
length starts to mean anything, and it is designed in
**`formula-design.md`**, which supersedes this section once it is built.

### Why the instruction list, when it comes, should not be an expression tree

Trees of arbitrary operators are classic tree-GP and carry two failure modes that
are fatal here specifically:

- **Bloat.** Trees grow without bound under mutation unless a parsimony pressure
  is added, and that pressure is fiddly to tune.
- **Destructive mutation.** Change a node near the root and the output changes
  completely, so lineages jump rather than drift and selection cannot accumulate
  small improvements. That directly contradicts the premise above — tracking a
  climate that wanders steadily requires small mutations with small effects.

Use **linear / Cartesian GP** instead: a fixed number of registers and a
fixed-length list of instructions. No bloat by construction, point mutations are
small, protected operators mean no NaN, and inactive instructions drift neutrally
and become raw material — a documented gain in evolvability rather than waste. It
is still an algorithm that can be *printed* for a lineage, and still genetic
rather than neural.

Inputs worth having: node age, depth from root, latitude, environment type and
the five affinities, child count — and two more that earn their place:

- **Local density of genetically similar neighbours.** This is Janzen–Connell
  available for free, and it is the insurance against monoculture if climate drift
  proves insufficient on its own.
- **The environment gradient, not just the environment.** A node that can sense
  which way conditions improve can evolve tropism, which is the difference between
  a blob and something that visibly reaches for a coastline.

### One program with seven outputs, and a configurable length

Seven quantities are wanted from the genome — five affinities, how badly a node
wants to bud, and which way it turns. Do **not** give each its own instruction
list. One program with seven designated output registers shares subexpressions,
lets affinity and behaviour co-evolve coherently instead of drifting apart, and
collapses "genome length" to a single meaningful number.

Length is a tuning parameter and belongs in the parameter block. Start short and
lengthen it when a lineage can be seen straining against the ceiling. Four
things about it:

- **No parsimony pressure when it lengthens.** In Cartesian GP the productive
  regime is a long genome with a short *active* path: the inactive instructions
  drift neutrally and are the reservoir that makes the genome evolvable. They
  look like waste and are not. This is the same property that made a fixed-length
  list the right choice in the first place.
- **Fixed for a whole run, never within one.** Horizontal transfer copies
  instruction blocks between genomes; mixed lengths turn that into an alignment
  problem for no gain.
- **Length is probably not where complex behaviour comes from.** Twenty
  instructions with rich inputs — gradient sensing, similar-neighbour density,
  depth, age — will out-behave two hundred with poor ones. Expect the leverage to
  be in the input set, and reach for length last.
- Evaluation cost multiplies against the death-scheduling pass, not the growth
  pass: 8 candidates per plant per turn is nothing, but re-estimating affinity as
  the climate drifts touches every node. See the implementation notes.

### Normalise the five affinities to a fixed total

Lifespan is monotonic in affinity and nothing costs affinity, so selection has no
reason to keep any of the five low — they would all drift upward until every node
likes everything and lives a long time everywhere. Not hyperspecialisation:
**affinity inflation**, ending in a bland immortal generalist. A fixed budget
makes specialisation zero-sum, so "generalists short-lived, specialists
long-lived at home" follows structurally instead of by tuning.

(Narrowing already has a natural cost — a narrow genome's frontier nodes die on
arrival, so the lineage stops spreading. Range-versus-persistence is sound. It is
the overall *level* that needs constraining, not the shape.)

### Mutate on the second child, not the first

Mutating every node means a thousand-node plant carries a thousand mutation
events; drift within one organism would swamp variation between organisms,
lineages blur, colours turn to mush and selection cannot accumulate.

In a branching model there is a natural place to put it. A node's **first** child
continues the sector and inherits the genome unchanged; its **second and later**
children are genuine bifurcations and mint a mutated genome. Long unbranched runs
therefore share a genotype, which gives visibly variegated plants whose sectors
are units selection can act on, and makes a severed branch a meaningful identity
rather than a smear.

One consequence to accept knowingly: branching rate and mutation rate become the
same knob, so a lineage that branches rarely also evolves slowly.

### One life-history axis: growth rate traded against lifespan

Without it every plant pursues the same strategy — be well-suited, grow —
differing only in *where*. That is a beautiful map but a thin drama: no pioneers
versus persisters, no fast-and-cheap versus slow-and-tough. The axis is nearly
free and it makes disturbance meaningful, since cleared ground becomes an
opportunity only weeds can exploit. It also restores a dimension in which genomes
can be plainly better or worse rather than only differently placed — which
normalising the affinities otherwise removes.

## Seeding, dispersal and borrowed DNA

**Initial seeding** is tens of single-node seeds with random genomes, scattered —
not one. A single lineage means no competition for a long time.

**Ongoing seeding is dispersal from existing plants, not new random genomes.** A
random genome dropped into a mature ecosystem is almost certainly unfit and dies,
so it adds no diversity in practice; a spore from a lineage that is already
working actually colonises. Mechanically: with small probability a bud places
itself at a distant free location instead of adjacent. Keep it rare enough that
each arrival reads as an event. Reserve de-novo seeding for near-extinction
rescue.

**Horizontal transfer between touching lineages.** Occasionally copy an
instruction block from a neighbouring plant's genome. Adjacency is already known
from the collision tests, so it costs almost nothing. It is thematically right —
lichens are literally symbioses — and it works against both monoculture and the
clonality that constant fragmentation would otherwise produce.

Guard it with a **genetic distance threshold**: no transfer between genomes too
far apart. That produces emergent species barriers, and gives a principled
definition of "species" for the acceptance test — which otherwise has nothing
stable to count, since plant objects churn every few seconds.

## Rendering

**Colour must be information, not decoration.** Map genome to colour through a
fixed projection, never random per lineage:

- **hue** — which environment the affinity vector favours
- **saturation** — how peaked it is, so generalists desaturate toward grey and
  specialists go vivid
- **lightness** — the life-history axis

Then related plants look related, convergent evolution shows up as the same
colour appearing independently in similar places, and because hue tracks niche
rather than lineage the planet bands naturally by climate and still reads as
plausible biomes. Per-lineage jitter destroys all of that.

**Not literal leaves.** At roughly 100 km between nodes a leaf would be a
continent. What is wanted is the same variety at the right scale: let each node
paint a **footprint whose size, elongation and orientation are genetic**.
Elongated along the heading reads as filamentous and streaky, round reads as
mossy, small and dense reads as crustose. That is leaf shape as seen from orbit,
and it absorbs the morphology-gene idea at no extra cost.

**Thickness from age, not from descendant count.** Da Vinci's rule (parent
cross-section equal to the sum of the children's) is the classical answer, but
maintaining exact subtree sizes under constant death and fragmentation costs
O(depth) per event, continuously. Age gives nearly the same picture for nothing,
and it composes: the old core is thick and dark *and about to die*, the frontier
is thin and bright. That is the frontier-brightness idea and the fairy-ring life
cycle told with one variable.

Also cheap and worth having: a subtle dark rim where two lineages meet.

## Parameters and experimentation

This system has far more knobs than the climate does, and most of them can only
be settled by running it. It needs to be cheap to try a variant.

**Not a separate file.** A config file cannot ship: `verify.js` fails the build
on any `<script src>` that is not a data URI, and a fetched config breaks
`file://`, which the piece supports. The single-file rule is not negotiable for
the sake of convenience during development.

What is wanted is available three ways instead, and the combination is better
than a file would have been:

- **A `PARAMS` block** — one object literal near the top of `index.html` holding
  every tunable, so nothing is scattered through the source. This is the
  single-place benefit without the file.
- **Hash overrides for everything in it.** The piece already parses `#seed=`;
  extend the same parsing to any parameter, so `#seed=7&glen=64&step=0.014` is an
  experiment with no edit and no risk of a debug value being committed. It also
  makes any run reproducible from a link — seed plus parameters fully determine a
  world, which is worth having for a piece people are meant to sit with.
- **A `window.__world.params()` hook**, so a script can sweep dozens of variants
  headlessly and report which survived. Editing and watching is far too slow to
  search a space this size, and the acceptance test below is exactly the predicate
  a sweep should score against.

**Build it at stage 0, not before.** Retrofitting the existing simulation's
constants is a refactor with regression risk on a piece that works and is
deployed — and stage 0 is what determines which parameters matter and what their
scale is. A parameter block written before that gets both wrong.

## Implementation notes

**Store the heading as a 3D tangent vector, never as an angle from north.** To
grow, rotate the tangent about the surface normal, step along the geodesic, then
parallel-transport the tangent to the new position. An angle relative to a lat/lon
frame breaks at the poles and at the seam — this repo already has that scar; see
the tangent-frame lesson in CLAUDE.md.

**Do not scan every node every turn.** Ageing every node is O(total nodes) per
tick, tens of thousands before anything interesting happens. A node's death time
is computable at birth, so bucket nodes by expected death turn and touch only
those due. Climate drift makes the estimate stale, which is fixed the way this
codebase already fixes it: `rebuildBand` amortises terrain across frames with a
rolling cursor, so re-estimate a slice of nodes per tick the same way.

**Collision is the easy part.** A uniform bin over the sphere with cell size
about `d` makes each test roughly nine bins, O(1). The design already bounds the
count well: 8 candidates times *plants*, not nodes.

**Time-lapse is the trap.** At ×100 the climate clock runs a hundred times
faster. If growth is per-frame the ecology freezes relative to the climate; if it
is per-simulated-second it explodes. Either way the piece breaks at exactly the
setting people use to watch it change. The ecology needs its own clock scaled
against the climate clock — and whatever rate is chosen, **re-check it at ×100
before believing it**, which is the same lesson the climate controller learned.

## Open questions

- **Growth preference.** The affinities could double as growth bias (grow toward
  cells you would like), which is economical but makes morphology purely
  environmental — lineages in the same environment would look alike. A small
  separate set of morphology genes (compactness versus exploration, anisotropy)
  restores variety cheaply, and overlaps with the footprint-shape genes above.
- **Mutation rate under stress.** Consider raising it as fitness falls.
  Biologically real, and it lets lineages track the drifting climate without a
  high baseline that would blur identity.
- **How large should a node be?** This sets everything else — whether a plant
  reads as a plate or a filigree, how many nodes the planet holds, and whether the
  320×160 climate grid is fine or coarse relative to a body. Stage 0 answers it.

## Ideas not yet decided

- **The ocean is two-thirds of the arena and currently inert.** Including sea in
  the five affinities opens it up. The risk is that open ocean has no structure,
  so a marine specialist sweeps all of it — but the blurred distance-to-water
  field already used for continentality, *inverted*, gives coastal proximity. Use
  it as nutrient limitation and you get green fringes along every shore and blue
  deserts in the open gyres, which is why real ocean productivity looks the way it
  does.
- **Allelopathy** as a diffusing inhibitor field — halos and no-man's-lands.
  Cheap: one more grid with diffusion, which the water-proximity blur already does.
- **Seasonal phenology genes** so lineages pulse out of phase across the year.
- **Weak climate feedback** (albedo, transpiration) for niche construction and a
  Daisyworld dynamic. **Not first** — it couples two feedback systems and the
  existing controller will fight it. Weak local coupling under a strong global
  governor, only once the ecology is stable.

## Build order

Each stage should be watchable before moving on.

0. **Legibility — done.** One plant, hand-written formulas, static planet,
   rendered.
   Does the form read as vegetation or as a circuit board? This is the cheapest
   stage and the only one that can invalidate every stage after it, so it goes
   first. Vary node size, footprint shape and branching angle by hand until
   something reads, and let *that* set the scale constants. The `PARAMS` block
   and its hash overrides land here, populated with what this stage proves
   matters.
1. **Occupancy, lifespan, death — done.** Plus heartwood, decay, and the marine
   niche, which had to come early because the sea is two thirds of the arena.
2. **Frontier maintenance — done**, and the allocation rule turned out to matter
   more than the maintenance.
3. **Branch mutation and inheritance — done.** Eleven-gene genome, life-history
   axis, genome→colour projection.
4. **Test the central claim.** Everything so far was measured on a frozen planet.
   Does a *moving* climate maintain diversity on its own, as this document has
   assumed throughout? Nothing else should be added until that is known, because
   the answer decides whether the next item is needed at all.
5. Frequency dependence, if and only if step 4 says climate drift is not enough.
6. Dispersal refinement, horizontal transfer and species barriers.
7. The instruction genome, gradient inputs, conditional behaviour.

## Risks

- **Spaghetti, not vegetation.** A branch network at planetary scale draws lines,
  and lines read as veins or circuitry rather than life. This is a bigger risk
  than anything in the evolution itself, and it is what stage 0 exists to answer.
- **Everything shatters.** Fragmentation is rewarded by the one-bud-per-plant
  rule. Watch the size distribution early; a floor on viable fragments may not be
  enough on its own.
- **CPU.** The climate step is already ~10 ms at 12 Hz. WebGL2 has no compute
  shaders, so this stays on the CPU. Death scheduling and frontier maintenance are
  what make it affordable, not micro-optimisation.
- **Integration hazard.** The humidity controller currently measures desert as
  `veg < 0.18`. If plants replace that field, the climate governor starts steering
  the *ecology* — nudging global humidity because a lineage is losing. That may be
  a stabiliser or a straitjacket, but it must be an explicit decision, not an
  accident.

## Acceptance test

Add to `tools/verify.js`, in the spirit of the existing homeostasis bounds:
**genetic diversity must not collapse over a simulated hour.** Measure it
genomically — mean pairwise distance across a sample of nodes, or the spread of
the colour projection — not by counting plant objects, which churn constantly
under fragmentation and would be pure noise. Watching it is not enough; that is
how you ship something that looks alive for five minutes.
