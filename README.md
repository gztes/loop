# Loop

A wardrobe app that scores clothes you already own on environmental impact, and answers the
question that actually changes behaviour: **should I buy this?** — by comparing a potential
purchase against what is already hanging in your wardrobe.

Built in a hackathon, which it won. Ships as a single self-contained HTML file: open it by
double-click, no build step, no server, **no network calls at all**.

```bash
git clone https://github.com/<you>/loop.git
cd loop
start loop-app.html      # Windows   (open loop-app.html on macOS)
```

---

## The design decision this project exists to make

An LLM will confidently produce a carbon figure it invented. Ask one how much water went into a
cotton shirt and it will give you a number, formatted convincingly, sourced from nothing. For a
product whose entire proposition is "trust this score," that is fatal.

So the model is kept **out of the number path entirely.**

Every environmental figure in Loop resolves deterministically:

```
fibre composition  →  factor table  →  intensity curves  →  weighted score
```

No figure is generated at runtime. The same garment always scores the same. Every number can be
traced back through the pipeline to a row in a versioned table, and the table is in the source
where anyone can argue with it.

Generative AI is used in this project — for the product photography and the promotional film.
It is not used anywhere a number is produced.

---

## How the scoring engine works

### 1. Factor table (`FACTORS_VERSION`)

Per kilogram of finished fibre, each material carries five factors: water (litres), CO₂e (kg),
a material-impact score, a durability score, and an end-of-life score.

| | water L/kg | CO₂e kg/kg | material | durability | end-of-life |
|---|---|---|---|---|---|
| Conventional cotton | 10,000 | 5.9 | 44 | 70 | 76 |
| Organic cotton | 6,000 | 3.8 | 73 | 70 | 80 |
| Recycled cotton | 2,000 | 2.2 | 86 | 62 | 74 |
| Linen | 2,500 | 2.1 | 88 | 74 | 92 |
| Lyocell (TENCEL) | 900 | 2.8 | 87 | 68 | 88 |
| Wool | 5,000 | 24.0 | 52 | 92 | 86 |
| Cashmere | 6,000 | 38.0 | 36 | 80 | 84 |
| Leather | 17,000 | 17.0 | 30 | 95 | 58 |
| Polyester | 60 | 9.5 | 27 | 78 | 29 |

Order-of-magnitude values in the range reported by Ecoinvent 3.9, the Higg MSI and WRAP. They are
versioned deliberately: when the numbers improve, the version increments and every score moves
with it, visibly.

### 2. Intensity curves

Raw per-kg intensity is not a score. A piecewise-linear curve maps it onto 0–100, so the
difference between 900 L/kg and 2,500 L/kg is meaningful while everything above 17,000 L/kg is
correctly flattened into "bad".

```js
const W_PTS = [[100,97],[900,90],[2500,79],[5000,61],[10000,35],[17000,17],[25000,8]];
const C_PTS = [[1.5,96],[3,88],[5,76],[7,64],[9.5,53],[14,37],[20,23],[40,7]];
```

### 3. Domain rules

Three judgment calls are encoded explicitly rather than buried:

- **Blend penalty.** A garment mixing natural and synthetic fibres takes a ×0.70 hit to its
  end-of-life score. Current recycling cannot separate mixed fibres, so a poly-cotton shirt is
  effectively unrecyclable regardless of how good either fibre is alone.
- **Second-hand attribution.** A second-hand garment is charged **30%** of the production burden —
  transport, cleaning, platform — with the remaining 70% attributed to the first owner. Where to
  draw that line is a genuine LCA allocation choice; this one is stated rather than hidden.
- **Care and origin.** Wash temperature, tumble-drying and dry-clean-only are penalised separately
  from the fibre. Undeclared country of manufacture is scored conservatively, not neutrally.

### 4. Weights

The seven dimensions combine into one score:

| dimension | weight |
|---|---|
| material | 22% |
| carbon | 20% |
| durability | 18% |
| water | 13% |
| manufacturing / origin | 10% |
| end-of-life | 9% |
| care | 8% |

Durability is weighted heavily on purpose. A garment worn for six years beats a garment that
scored well once and was worn twice — which is the same argument the "should I buy this?" feature
makes.

---

## The language layer is deterministic too

Loop answers questions like *"black clothes for work"*, *"something for 15°C"* and
*"do I need another black dress?"*. None of it is a language model.

Intent is parsed with explicit slot-filling — a regex pulls the temperature, keyword sets resolve
colour, occasion, season and weather — and the result is a filter over real wardrobe data. Every
answer is therefore something the app can show you the working for. It is less flexible than an
LLM and that is the trade: it cannot answer everything, but it cannot make anything up either.

Duplicate detection clusters by **function**, not category — family + category + occasion — so it
can tell you that you own four things that do the same job, which a category filter never would.

---

## Running the tests

Three headless harnesses. They read `loop-app.html`, extract the script block and execute it in a
`vm` sandbox against a stubbed DOM — so they test the shipped file, not a copy of it.

```bash
node tests/smoke.js   # scoring engine, wardrobe stats, search, filters,
                      # "should I buy this?", scan flow, every screen renders
node tests/audit.js   # renders every screen and audits the HTML: no undefined/NaN,
                      # balanced tags, every inline handler defined, no dead buttons
node tests/site.js    # marketing page: screen builders, scroll engine, markup balance
```

All three pass on the committed file.

The DOM stub is deliberately thin. If you use a DOM API it does not implement, the harness fails
with something like `x.classList.toggle is not a function` — that is a gap in the stub, not a bug
in the app. Add the stub and re-run.

---

## Layout

`loop-app.html` is one file: a `<style>` block, the markup, then one `<script>` organised into
numbered modules. Grep for `/* ---- NN.` to navigate.

| module | contents |
|---|---|
| 1–4 | factor tables and the demo wardrobe |
| 5 | `scoreGarment()` — the engine |
| 6–8 | state, helpers, wardrobe-level scoring |
| 9 | router |
| 10–19 | one render function per screen |
| 21–22 | embedded imagery, mobile demo mode |
| 23–24 | scroll engine and marketing page |
| 25–28 | brand mark, status bar, guided demo, boot |

---

## Honest limitations

- The factor tables are order-of-magnitude reference values, not a certified LCA. Loop is a tool
  for relative comparison between garments, not for reporting an absolute footprint.
- The demo wardrobe is 18 garments of synthetic data. There is no backend, no accounts, no sync.
- Garment entry is manual. The scan flow demonstrates the interaction; it does not do real
  image recognition.
- `Verified` and `AI estimated` badges appear throughout the interface. They are load-bearing —
  the product never presents an estimate as if it were confirmed, and the badges are how it keeps
  that promise.

---

## Licence

MIT — see [LICENSE](LICENSE).
