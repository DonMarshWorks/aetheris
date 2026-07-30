# Evolving plants — design brief

Status: **agreed in outline, not started.** This is the record of a design
discussion between Don and Claude. Read it before writing any of it.

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

We already have a better one. The climate genuinely wanders — coastlines migrate,
deserts move, ice advances — while the controller keeps every environment
*present* and merely relocates it. A specialist perfectly tuned to today is
maladapted in twenty minutes, because its niche walked away. **Adaptation never
completes.** Lean on this rather than adding artificial diversity pressure.

This is also the reason mutation must be *incremental*. A lineage tracking a
niche that is walking away at a steady rate needs small changes that accumulate.
Anything that makes offspring jump rather than drift breaks the central premise —
see the genome section.

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

Note this is where the earlier model's rule "define a plant as a connected
component, not a parent chain" no longer applies. That rule existed because grid
neighbours heal an interior death. In a branching model there are no neighbours
to heal with, so an interior death genuinely severs — and since that produces the
fairy ring above rather than noise, it should be embraced rather than patched.

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

## The genome

### Prefer a fixed-length instruction list to a free expression tree

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

0. **Legibility.** One plant, hand-written formulas, static planet, rendered.
   Does the form read as vegetation or as a circuit board? This is the cheapest
   stage and the only one that can invalidate every stage after it, so it goes
   first. Vary node size, footprint shape and branching angle by hand until
   something reads, and let *that* set the scale constants.
1. Occupancy, affinities, lifespan, death. No evolution. Confirm the mosaic moves
   and borders do not freeze.
2. Frontier maintenance and the size distribution that falls out of it.
3. Branch mutation and inheritance. Confirm adaptation to the standing climate.
4. Fragmentation and the fairy-ring life cycle.
5. Life-history axis and disturbance.
6. Genome→colour mapping, footprint shape, frontier and thickness rendering.
7. Dispersal, horizontal transfer and species barriers.
8. Marine niche.

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
