# Evolving formulas — design brief

Status: **agreed in outline, not started.** Record of a design discussion between
Don and Claude. Read it, and `plants-design.md`, before writing any of it.

This replaces the scalar genome. Eleven floats per node bought real selection —
pace under directional pressure, niches redistributing unbidden — but every
lineage ends up much the same shape, because a number cannot say *when*. A formula
can. It can say branch harder near the root, or reach when the ground improves,
or pulse.

## What a formula is for

Two of them, evaluated on different clocks. That distinction is the whole design
and it was nearly missed:

| formula | evaluated | output |
|---|---|---|
| **capacity** | once, at birth, fixed for life | how many children this node may ever have, 1–5 |
| **vigour** | every time the node is considered for a birth | how badly it wants one; highest bidder wins |

Because capacity is fixed at birth, a body records the conditions it grew
through: a node born in a good year is built differently from its own child born
in a bad one, permanently. Because vigour is re-evaluated, it can depend on age —
rising as a node matures, or oscillating if age is fed through a sine, which is
where whorls and rhythmic branching come from.

## Capacity, slots and shape

**Output maps to 1–5 by squashing, not by modulo.** `round(x) mod 5` is chaotic:
4.9 gives five slots and 5.1 gives one, so the tiniest mutation turns a branch hub
into a vine segment. That is precisely the destructive-mutation failure a
fixed-length genome exists to avoid — lineages must drift in order to track a
climate that keeps moving. Use `1 + floor(4.999 * (tanh(x/4)*0.5 + 0.5))`: every
number lands in range, nothing is wasted, and small changes usually stay put.

**1–5 is not a chosen number, it is what the geometry permits.** Children sit on a
circle of radius `d` and must stay `r_c` apart; at `r_c = d` that is 60° apart, so
six positions, one of which is taken by the parent.

**A slot is an angular position, not a counter.** Slots are 0°, ±60°, ±120°
relative to the heading the node inherited, allocated in that order. So capacity 1
is a vine running straight, capacity 3 is a Y, capacity 5 is a rosette. The
positions are collision-valid by construction, and ±120° sits at the boundary
where blocking becomes likely — natural failure without a wasted output range.

Shape therefore becomes *readable*: a lineage that builds hubs at the base and
vines at the tips looks that way because that is literally what it is doing.

**Eligibility replaces failure counters.** A node is eligible while it has unused
slots and ineligible once full. A blocked slot is not a failure to be counted —
only a subset of nodes is evaluated each birth cycle, so a node passed over now is
reconsidered later, by which time whatever blocked it may be gone. No retirement
policy, no readmission sweep, no arbitrary constant.

Capacity replaces the `branch` scalar gene outright.

## The instruction set

A fixed-length list of instructions over a small bank of registers — linear GP,
not expression trees. No bloat by construction, point mutations stay small, and
inactive instructions drift neutrally and become the raw material that makes a
genome evolvable rather than brittle.

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

All scaled to roughly [-1, 1], so the genome does not have to discover units.

- **age** — the input that makes vigour worth re-evaluating at all
- **depth from root** — capacity falling with depth gives trees, rising gives
  explosive bushes, oscillating gives whorls. The single most productive input
- **fit** at this node, and the **five environment memberships**
- **latitude**
- **slots already used**, and the **parent's capacity** — so an architecture can
  inherit a rule rather than a value
- **local crowding** — living neighbours within a short radius
- a constant **1**

Later, once the rest works: the **environment gradient**, which is what would let
a lineage evolve to branch *toward* better ground rather than merely surviving
where it happens to land.

## Mutation

Point mutation on a randomly chosen instruction — change its operator, one of its
source registers, or its immediate. Fixed length, so no bloat and no parsimony
pressure to tune. Minted where a branch forks and never per node, so a sector
stays a coherent unit for selection to act on.

## Observability — build this first, not last

A stale function shadowed its replacement for four commits of this project. It
returned NaN, `NaN|0` is `0`, and a `Math.max` downstream turned total failure
into a plausible constant. Fit-based selection was switched off the entire time,
two mechanisms were built on top of the bug, and confident explanations were
written for what the numbers were doing. Nothing threw. Nothing logged.

Small steps would not have caught that. A counter on the line would have caught it
in minutes. So, from the first commit:

- **output distributions** for both formulas — min, median, max, and the share of
  nodes landing on each capacity 1–5. A flat spread means the formula is ignoring
  its inputs; a single spike means it is a constant wearing a program's clothes
- **active instruction count** — how many instructions actually reach an output.
  If that is one, nothing is being computed, however long the program is
- **a non-finite counter**, expected to stay at zero and *checked* rather than
  assumed
- **input variance** — an input that never varies is not an input

## Open questions

- **Program length.** Start around 24 instructions. It is a parameter, and the
  whole point of a fixed-length genome is that trying another value is cheap.
- **How many registers**, and how many evolved constants.
- **Do the remaining scalar genes stay?** Pace, spread and elongation are still
  numbers. Probably yes at first — one conditional output at a time is testable.
- **Is the eligible set small enough?** The frontier currently saturates at
  130,000 entries and uniform sampling wastes most draws on nodes that cannot
  grow. Slot-eligibility should shrink that a great deal, but it wants measuring
  rather than assuming.
