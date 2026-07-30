# Aetheris

**A world, slowly becoming.** A procedural planet that never stops changing — and never runs away.

**→ [See it live](https://donmarshworks.github.io/aetheris/)**

![Aetheris](screenshot.jpg)

Coastlines drift and reshape. Forests spread into grassland, grassland dries into desert, desert is recolonised. Snow advances and retreats with the seasons; ice sheets grow ragged tongues and then collapse. Nothing repeats, nothing is scripted, and no environment ever disappears or takes over.

One HTML file. No dependencies, no build step, nothing fetched from the network.

## Watching it

Leave it running. The interesting thing about the piece is the timescale — it is meant to reward being ignored for an hour, the way a window does.

If you want to see the change without waiting, the ×20 and ×100 controls compress an hour into minutes.

| | |
|---|---|
| **drag** | orbit the camera |
| **scroll** or **pinch** | zoom (close in and the clouds and ring dissolve) |
| **click / tap** | show or hide the interface |
| **play button** or **space** | pause |
| **×1 / ×20 / ×100** or **1 / 2 / 3** | time-lapse |

On touch devices one finger orbits and two pinch to zoom. The page itself
cannot be zoomed or scrolled — the interface stays a fixed size while only
the planet scales.

Every visit generates a different world. To return to a particular one, append its seed to the URL:

```
https://donmarshworks.github.io/aetheris/#seed=31337
```

## The part that took the thinking

The hard problem is not making a planet change. It is making a planet change *forever* without degenerating — because any system with feedback and no governor eventually finds a corner and stays there. Left alone, a world like this becomes a snowball, or an ocean, or one continuous desert, and then nothing happens ever again.

So the climate runs as a **control loop**. Three global dials — sea level, mean temperature, atmospheric humidity — are steered by measuring the world and correcting it:

- ocean coverage drifts from target → sea level is nudged
- ice coverage drifts → global temperature is nudged, with polar amplification so the ice line can move without cooking the tropics
- desert share of land drifts → humidity is nudged

The corrections are rate-limited, so the loop stays stable even when the time-lapse hands it a huge step. Local weather, vegetation and terrain are free to wander; only the global budget is held. The result is a world with weather, seasons, droughts and ice ages, none of which are permanent.

Measured over a simulated hour, ocean coverage stays within about 62–64%, ice within 7–10%, while forest, grassland and desert trade places freely underneath.

## How it works

**Terrain.** Six octaves of Perlin noise sampled on the sphere, each slowly rotating on its own axis and breathing in amplitude. That drift is what moves coastlines: continents genuinely change shape rather than looping through a cycle. A ridged noise term adds mountain belts over land.

**Climate.** A 320×160 latitude/longitude grid, stepped about 12 times a second. Temperature from latitude, solar declination, elevation and a drifting anomaly field. Moisture from ocean proximity (a blurred distance-to-water field) crossed with Hadley-cell latitude bands, so deserts form around 30° and rainforest at the equator. Vegetation grows where it is warm and wet enough, dies back where it is not, and **diffuses into its neighbours** — which is what produces visible colonisation fronts rather than blocks of biome switching state.

**Ice.** Snow tracks temperature, but with an albedo feedback: white ground keeps itself cold. That positive feedback plus lateral diffusion is why ice sheets are sticky and ragged, growing peninsulas and stranding floes, instead of tracking a latitude circle.

**The ring.** A faint equatorial ring, standing well clear of the surface, there mostly to say where you are looking from: it projects to an ellipse whose flatness is the viewing angle, edge-on from the equator and a full circle from the pole, needing no legend to be read. It earns its keep twice, because the axis is tilted 24° and the star's declination swings through the year, so the shadow the ring throws migrates north and south across the surface — an annual clock that falls out of the geometry rather than being drawn on. The planet shadows the ring in turn, and the ring brightens when backlit, which happens to peak as the star passes behind the planet. It fades out as you zoom in, where it would be an arc sweeping the frame and would tell you nothing.

**Rendering.** WebGL2, hand-rolled, no libraries. The simulation grid uploads to a float texture; the fragment shader reads it through a Catmull-Rom filter with analytic derivatives for relief shading, and adds fractal detail so a coarse grid yields organic coastlines. Surface detail is band-limited against the pixel footprint to avoid aliasing. Atmospheric scattering is evaluated along the whole chord of air a sightline crosses, which is why the limb still glows when the star passes behind the planet.

Relief is deliberately understated. Seen from orbit, Everest is 9 km against a 6,370 km radius — mountain ranges read by snow and rock colour, not by shadow. Rendering them any other way looks like a bug.

## Three clocks, deliberately mismatched

There is no single geological time here, and the interface says so rather than inventing one. The three processes are compressed by wildly different factors so that all of them are visible in one sitting:

| | compression |
|---|---|
| rotation — a day every 2½ minutes | ~600× |
| seasons — a year every 15 minutes | ~35,000× |
| continental drift — new outlines in ~40 minutes | ~1,000,000,000,000× |

Those differ by nine orders of magnitude. Any single "years elapsed" counter would contradict the other two, so the interface states the rates instead. Time-lapse scales the climate and the tectonics but deliberately leaves rotation alone, so the planet never becomes a blur.

Erosion is not modelled. Neither is plate tectonics proper — the drifting noise is an impression of it, not a simulation.

## Requirements

A browser with WebGL2 — any current Chrome, Edge, Firefox or Safari — and hardware acceleration enabled. Resolution adapts automatically if the frame rate drops. It is comfortable on integrated graphics, and works on phones.

## Publishing your own copy

`publish.sh` (macOS/Linux) and `publish.ps1` (Windows) bake your GitHub username
into the social-preview metadata and make the first commit:

```
./publish.sh your-github-username        # or  .\publish.ps1 your-github-username
```

Then create an empty public repo, push, and set **Settings → Pages → Deploy from
a branch → main / (root)**. The scripts print the exact commands.

## License

MIT. See [LICENSE](LICENSE).

---

Built with [Claude](https://claude.com/claude-code).
