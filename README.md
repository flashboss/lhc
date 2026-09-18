# Didactic nuclear transmutation simulation

Educational Monte Carlo model of a theoretical source-to-product transmutation. It does **not** represent real accelerator physics, and it does **not** produce real nuclei.

The graphical console shows every step: parameter setup, each virtual collision (random draw `u` compared with probability `p`), transmutation events, and the final equivalent product mass. Open the **Animations** menu to choose **Beam on target** (straight virtual beam) and **Particles in the ring** (circular bunches).

Default source and product nuclides, together with their molar masses, are defined in the program. Override them from the command line; they are not part of the model description.

Nuclides must be a real element symbol, optionally with a mass number (`Fe`, `56Fe`). The molar mass is taken from the nuclide. A far jump in proton or nucleon number lowers the model probability `p_model`, so different elements do not behave the same.

## Requirements

- Python 3.9+
- A web browser (for the graphical view)

No extra Python packages are required. The standard library serves the UI and opens it in the browser.

## Run

Graphical view (default):

```bash
python3 src/transmutation.py
```

Text-only output:

```bash
python3 src/transmutation.py --cli
```

Stop the graphical session with Ctrl+C in the terminal.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--source-nuclide` | program default | Source nuclide (`symbol` or `mass+symbol`) |
| `--product-nuclide` | program default | Product nuclide (`symbol` or `mass+symbol`) |
| `--source-mass-g` | `100` | Theoretical initial target mass in grams |
| `--source-fraction` | `0.524` | Fraction of the source nuclide in the target |
| `--source-molar-mass-g` | from the nuclide | Molar mass of the source nuclide in g/mol |
| `--product-molar-mass-g` | from the nuclide | Molar mass of the product nuclide in g/mol |
| `--collisions` | `100000` | Number of virtual collisions |
| `--probability` | `0.0001` | Didactic per-collision scale; the run uses `p_model` |
| `--workers` | CPU count | Parallel processes (CLI mode only) |
| `--seed` | `42` | Random seed for reproducible runs |
| `--lang` | `en` | Language for the UI and `--cli` output: `en`, `it`, `pt`, `es`, `de`, `zh`, `ja`, `fr` |
| `--cli` | off | Print results in the terminal instead of opening the UI |

Example:

```bash
python3 src/transmutation.py --source-mass-g 100 --collisions 50000 --probability 0.0002
```

## Graphical console

The UI walks through the model in order:

1. Setup: target mass, candidate nuclei, expected events
2. Collisions: each trial draws `u ~ Uniform(0, 1)` and transmutes if `u < p_model`
3. Results: simulated vs expected events and equivalent product mass

Controls:

- **Language** — Portuguese, Spanish, English, Italian, German, Chinese, Japanese and French. Opening the page in a browser uses the browser language. From the command line, `--lang` (default `en`) applies to both the UI and `--cli` text output; the combo in the UI can still change it
- **Parameters** — choose source and product elements from the lists, set the mass number, then edit masses, collisions, probability and seed and choose **Apply** to restart. Changing the element updates the molar mass and the model probability
- **Speed** — from one operation at a time to maximum throughput
- **Pause / Resume** — Space also toggles pause
- **Restart** — reload the current parameters

At slower speeds the log lists every collision. Faster speeds still show the current operation live and record every transmutation.

## Model

The target is treated as a mixture that includes a configurable source nuclide. Candidate nuclei are:

```text
N(source) = m(source) / M(source) × N_A
```

`M(source)` comes from the chosen nuclide. Each virtual collision can convert at most one candidate nucleus. The scale `p` is reduced when source and product sit far apart in Z and A:

```text
p_model = p × 6 / max(6, |ΔZ| + |ΔA|)
expected events = collisions × p_model
```

The equivalent product mass is:

```text
m(product) = N(product) × M(product) / N_A
```

CLI mode splits collisions across processes. Graphical mode runs them sequentially so each operation can be displayed.

## Warning

- No real collisions take place
- No real nuclei are produced
- The probability is purely didactic
- The initial mass is a model parameter, not a laboratory sample
