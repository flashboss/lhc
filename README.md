# Didactic nuclear transmutation simulation

Educational Monte Carlo model of a theoretical source-to-product transmutation. It does **not** represent real accelerator physics, and it does **not** produce real nuclei.

The graphical console shows every step: parameter setup, each virtual collision (random draw `u` compared with probability `p`), transmutation events, and the final equivalent product mass.

Default source and product nuclides, together with their molar masses, are defined in the program. Override them from the command line; they are not part of the model description.

## Requirements

- Python 3.9+
- A web browser (for the graphical view)

No extra Python packages are required. The standard library serves the UI and opens it in the browser.

## Run

Graphical view (default):

```bash
python3 src/trasmutazione.py
```

Text-only output:

```bash
python3 src/trasmutazione.py --cli
```

Stop the graphical session with Ctrl+C in the terminal.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--source-nuclide` | program default | Label of the source nuclide |
| `--product-nuclide` | program default | Label of the product nuclide |
| `--source-mass-g` | `100` | Theoretical initial target mass in grams |
| `--source-fraction` | `0.524` | Fraction of the source nuclide in the target |
| `--source-molar-mass-g` | program default | Molar mass of the source nuclide in g/mol |
| `--product-molar-mass-g` | program default | Molar mass of the product nuclide in g/mol |
| `--collisions` | `100000` | Number of virtual collisions |
| `--probability` | `0.0001` | Didactic per-collision transmutation probability |
| `--workers` | CPU count | Parallel processes (CLI mode only) |
| `--seed` | `42` | Random seed for reproducible runs |
| `--cli` | off | Print results in the terminal instead of opening the UI |

Example:

```bash
python3 src/trasmutazione.py --source-mass-g 100 --collisions 50000 --probability 0.0002
```

## Graphical console

The UI walks through the model in order:

1. Setup: target mass, candidate nuclei, expected events
2. Collisions: each trial draws `u ~ Uniform(0, 1)` and transmutes if `u < p`
3. Results: simulated vs expected events and equivalent product mass

Controls:

- **Speed** — from one operation at a time to maximum throughput
- **Pause / Resume** — Space also toggles pause
- **Restart** — reload the current parameters

At slower speeds the log lists every collision. Faster speeds still show the current operation live and record every transmutation.

## Model

The target is treated as a mixture that includes a configurable source nuclide. Candidate nuclei are:

```text
N(source) = m(source) / M(source) × N_A
```

Each virtual collision can convert at most one candidate nucleus. Expected events are `collisions × probability`. The equivalent product mass is:

```text
m(product) = N(product) × M(product) / N_A
```

CLI mode splits collisions across processes. Graphical mode runs them sequentially so each operation can be displayed.

## Warning

- No real collisions take place
- No real nuclei are produced
- The probability is purely didactic
- The initial mass is a model parameter, not a laboratory sample
