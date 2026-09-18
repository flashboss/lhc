# Didactic 208Pb → 205Au simulation

Educational Monte Carlo model of a theoretical lead-to-gold transmutation. It does **not** represent real LHC physics, and it does **not** produce real gold.

The graphical console shows every step: parameter setup, each virtual collision (random draw `u` compared with probability `p`), transmutation events, and the final equivalent gold mass.

## Requirements

- Python 3.9+
- A web browser (for the graphical view)

No extra Python packages are required. The standard library serves the UI and opens it in the browser.

## Run

Graphical view (default):

```bash
python3 src/trasmutazione_pb_au.py
```

Text-only output:

```bash
python3 src/trasmutazione_pb_au.py --cli
```

Stop the graphical session with Ctrl+C in the terminal.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--lead-mass-g` | `100` | Theoretical initial lead mass in grams |
| `--pb208-fraction` | `0.524` | Theoretical Pb-208 fraction in natural lead |
| `--collisions` | `100000` | Number of virtual collisions |
| `--probability` | `0.0001` | Didactic per-collision transmutation probability |
| `--workers` | CPU count | Parallel processes (CLI mode only) |
| `--seed` | `42` | Random seed for reproducible runs |
| `--cli` | off | Print results in the terminal instead of opening the UI |

Example:

```bash
python3 src/trasmutazione_pb_au.py --lead-mass-g 100 --collisions 50000 --probability 0.0002
```

## Graphical console

The UI walks through the model in order:

1. Setup: lead mass, Pb-208 nuclei, expected events
2. Collisions: each trial draws `u ~ Uniform(0, 1)` and transmutes if `u < p`
3. Results: simulated vs expected events and equivalent Au-205 mass

Controls:

- **Speed** — from one operation at a time to maximum throughput
- **Pause / Resume** — Space also toggles pause
- **Restart** — reload the current parameters

At slower speeds the log lists every collision. Faster speeds still show the current operation live and record every transmutation.

## Model

Natural lead is treated as a mixture that includes Pb-208. Candidate nuclei are:

```text
N(Pb-208) = m(Pb-208) / M(Pb-208) × N_A
```

Each virtual collision can convert at most one candidate nucleus. Expected events are `collisions × probability`. The equivalent gold mass is:

```text
m(Au-205) = N(Au-205) × M(Au-205) / N_A
```

CLI mode splits collisions across processes. Graphical mode runs them sequentially so each operation can be displayed.

## Warning

- No real collisions take place
- No real gold is produced
- The probability is purely didactic
- The initial mass is a model parameter, not a laboratory sample
