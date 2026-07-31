# Evolving formulas — design brief

Status: **agreed, not started.** Record of a design discussion between Don and
Claude. Read it, and `plants-design.md`, before writing any of it.

This replaces the scalar genome. Eleven floats per node bought real selection —
niches redistributing unbidden, lineages committing to the sea nobody told them
to take — but every lineage ends up much the same shape, because a number cannot
say *when*. A formula can.

## The target behaviour

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
remaining. A slot blocked by a neighbour is simply not taken this time; the node
stays eligible and may be picked again later, by which time the obstruction may be
gone.

**Odd capacities keep the main axis, even ones split it.** That is deliberate
rather than an oversight. Committing the whole system to one habit — monopodial
like a tree, or dichotomous like many algae — would throw away a dimension.
Instead capacity itself carries the distinction, and a lineage wanting a
persistent trunk evolves odd capacities down it.

**Eligibility replaces failure counters.** A node is eligible while it has unused
slots and mature enough to use them; full nodes are done. Only a subset is
evaluated per cycle, so being passed over is not a penalty and no retirement
policy or arbitrary retry constant is needed.

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

**The five affinities stay a normalised vector, not a formula.** The fixed budget
is load-bearing: it is what stops the drift to a bland immortal generalist, and
there are measurements showing what unconstrained affinity does. A formula output
cannot easily be budget-constrained across five values. It is also what colour is
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
- **local crowding** — living neighbours within a short radius
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

## Open questions

- **Program length.** Start around 24 instructions. It is a parameter, and the
  point of a fixed-length genome is that trying another is cheap.
- **How many registers**, and how many evolved constants.
- **Is the eligible set small enough?** The frontier currently saturates at
  130,000 entries and uniform sampling wastes most draws on nodes that cannot
  grow. Slot-eligibility and the maturity gate should shrink it a great deal, but
  that wants measuring rather than assuming.
