# Evolving plants — design brief

Status: **agreed in outline, not started.** This is the record of a design
discussion between Don and Claude. Read it before writing any of it.

## The goal

The planet becomes an arena for competing plants that consume area no other
plant can occupy. Growth is governed by **evolving algorithms** — genetic, not
neural — so lineages adapt both to environments and to each other's strategies.
Plants are enormous on a planetary scale; the visual reference is **crustose
lichen on stone**: crisp-bordered, colour-varied, slowly contesting mosaics.

## What makes this planet a good arena

The two ways this genre of simulation dies are **monoculture** (one lineage wins,
diversity goes to zero) and **frozen mosaic** (borders equilibrate and stop
moving). The usual remedies are artificial.

We already have a better one. The climate genuinely wanders — coastlines migrate,
deserts move, ice advances — while the controller keeps every environment
*present* and merely relocates it. A specialist perfectly tuned to today is
maladapted in twenty minutes, because its niche walked away. **Adaptation never
completes.** Lean on this rather than adding artificial diversity pressure.

## The model

### Nodes, lifespan, fragmentation  (Don's design — adopted)

- The unit of occupancy is a **grid cell**. One plant per cell, exclusive.
  Weight area by `cos(lat)`; equirectangular cells are not equal in size.
- Each node carries **five formulas** giving its affinity for each environment,
  **including sea**.
- A node's **lifespan is derived from its affinity for where it actually sits.**
  Not a gene. This is important: a lifespan gene under selection just ratchets
  toward immortality and needs an artificial cap, whereas deriving it from fit
  means the body's persistence is sculpted by terrain automatically — a lineage's
  shape hugs the ground that suits it with no code that says so.
- **All nodes die eventually.**
- When a node dies and severs a body, the separated part **becomes an
  independent plant**. Advancing sea or ice cuts plants not suited to them.

Fragmentation is the strongest idea in the design. It makes individuality
*emergent* rather than declared, it gives vegetative reproduction (how real
clonal plants, corals and lichens actually propagate), and it turns climate
change into **allopatric speciation** — a sea-level rise that cuts a landmass
literally cuts a lineage in two and they diverge. That is the existing climate
system acting as a speciation engine, for free.

Note this makes a transport-cost-from-core mechanism unnecessary; lifespan-from-
fit limits and shapes bodies better.

### Four agreed changes

**1. Normalise the five affinities to a fixed total.**
Lifespan is monotonic in affinity and nothing costs affinity, so selection has no
reason to keep any of the five low — they would all drift upward until every
node likes everything and lives a long time everywhere. Not hyperspecialisation:
**affinity inflation**, ending in a bland immortal generalist. A fixed budget
makes specialisation zero-sum, so "generalists short-lived, specialists
long-lived at home" follows structurally instead of by tuning.

(Narrowing already has a natural cost — a narrow genome's frontier nodes die on
arrival, so the lineage stops spreading. Range-versus-persistence is sound. It
is the overall *level* that needs constraining, not the shape.)

**2. Mutate on branch/shoot initiation, not per node.**
Mutating every cell means a thousand-cell plant carries a thousand mutation
events; drift within one organism would swamp variation between organisms,
lineages blur, colours turn to mush and selection cannot accumulate. Minting a
genotype only when a branch starts gives **coherent sectors** — visibly
variegated plants, each sector a unit selection can act on — and makes a severed
branch a meaningful identity rather than a smear.

**3. Define a plant as a connected component, not a parent chain.**
A tree topology severs on every interior death, fragmenting large plants
continuously into thousands of trivial ones. Connectivity through any
same-lineage neighbour heals single deaths but still severs decisively when an
ice sheet cuts a continent — the drama without the noise. Keep parent pointers
for morphology if useful; just don't let them define identity.

**4. Add one life-history axis: growth rate traded against lifespan.**
As designed, every plant pursues the same strategy — be well-suited, grow —
differing only in *where*. That is a beautiful map but a thin drama: no pioneers
versus persisters, no fast-and-cheap versus slow-and-tough. This axis is nearly
free and it makes disturbance meaningful, since cleared ground becomes an
opportunity only weeds can exploit. It also restores a dimension in which
genomes can be plainly better or worse rather than only differently placed —
which normalisation (change 1) otherwise removes.

## Open questions

- **Contest.** Unspecified so far. What happens when two plants want the same
  cell? If first-come-first-served, competition reduces to speed and
  persistence. Probabilistic bids (softmax) rather than deterministic contests —
  deterministic ones freeze borders, which is the visual death of the piece.
- **Growth preference.** The affinities could double as growth bias (grow toward
  cells you would like), which is economical but makes morphology purely
  environmental — lineages in the same environment would look alike. A small
  separate set of morphology genes (compactness vs exploration, anisotropy)
  restores variety cheaply.
- **Seeding.** Don hoped it becomes unnecessary. Claude disagrees: without rare
  long-range dispersal an island that goes barren stays barren, and since sea
  level constantly makes and breaks land bridges, isolated landmasses drift
  toward impoverishment. Keep spores rare enough that each arrival reads as an
  event.
- **Mutation rate.** Consider raising it under stress (falling fitness).
  Biologically real, and it lets lineages track the drifting climate without a
  high baseline that would blur identity.

## Ideas not yet decided

- **The ocean is two-thirds of the arena and currently inert.** Including sea in
  the five affinities opens it up. The risk is that open ocean has no structure,
  so a marine specialist sweeps all of it — but the blurred distance-to-water
  field already used for continentality, *inverted*, gives coastal proximity.
  Use it as nutrient limitation and you get green fringes along every shore and
  blue deserts in the open gyres, which is why real ocean productivity looks the
  way it does.
- **Density-dependent mortality** (Janzen–Connell): risk rising with the local
  density of genetically similar neighbours. Cheap, biologically real, and very
  effective against monoculture if climate drift proves insufficient.
- **Allelopathy** as a diffusing inhibitor field — halos and no-man's-lands.
  Cheap: one more grid with diffusion, which the water-proximity blur already does.
- **Seasonal phenology genes** so lineages pulse out of phase across the year.
- **Weak climate feedback** (albedo, transpiration) for niche construction and a
  Daisyworld dynamic. **Not first** — it couples two feedback systems and the
  existing controller will fight it. Weak local coupling under a strong global
  governor, only once the ecology is stable.

## Rendering

**Colour must be information, not decoration.** Map genome to colour through a
fixed projection — temperature optimum → hue, moisture optimum → saturation,
life-history → lightness. Never random per-lineage colours. Then related plants
look related, convergent evolution shows up as the same colour appearing
independently in similar places, and because hue tracks niche rather than
lineage the planet bands naturally by climate and still reads as plausible biomes.

Two cheap additions carry most of the beauty: a subtle dark rim where two
lineages meet, and brighter young colour at the growth frontier fading to darker
mature interior — which makes expansion readable as *motion*.

## Build order

Each stage should be watchable before moving on.

1. Occupancy, affinities, lifespan, death. No evolution. Confirm the mosaic
   moves and borders do not freeze.
2. Branch mutation and inheritance. Confirm adaptation to the standing climate.
3. Fragmentation and connected-component identity.
4. Contest mechanics.
5. Life-history axis and disturbance.
6. Genome→colour mapping and frontier rendering.
7. Marine niche.

## Risks

- **Confetti, not lichen.** 51,200 individually coloured cells can read as
  static. Mitigated by large plants, niche-based colour and border rendering —
  but this is a bigger risk than anything in the evolution itself.
- **CPU.** The climate step is already ~10 ms at 12 Hz. WebGL2 has no compute
  shaders, so this stays on the CPU. Maintain an explicit **frontier set**: the
  active set is the perimeter, not the area.
- **Integration hazard.** The humidity controller currently measures desert as
  `veg < 0.18`. If plants replace that field, the climate governor starts
  steering the *ecology* — nudging global humidity because a lineage is losing.
  That may be a stabiliser or a straitjacket, but it must be an explicit
  decision, not an accident.

## Acceptance test

Add to `tools/verify.js`, in the spirit of the existing homeostasis bounds:
**lineage count and trait diversity must not collapse over a simulated hour.**
Watching it is not enough — that is how you ship something that looks alive for
five minutes.
