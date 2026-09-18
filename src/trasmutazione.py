#!/usr/bin/env python3

from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode
import argparse
import os
import random
import threading
import webbrowser

from cli_i18n import cli_t


AVOGADRO = 6.02214076e23
DEFAULT_SOURCE_NUCLIDE = "208Pb"
DEFAULT_PRODUCT_NUCLIDE = "205Au"
DEFAULT_SOURCE_MOLAR_MASS_G = 207.9766525
DEFAULT_PRODUCT_MOLAR_MASS_G = 204.974
DEFAULT_SOURCE_MASS_G = 100.0
DEFAULT_SOURCE_FRACTION = 0.524
SUPPORTED_LANGS = ("en", "it", "pt", "es", "de", "zh", "ja", "fr")


@dataclass
class BatchResult:
    collisions: int
    candidate_nuclei: int
    product_nuclei: int


def simulate_batch(args):
    collisions, candidate_nuclei, probability, seed = args
    rng = random.Random(seed)

    product_nuclei = 0

    for _ in range(collisions):
        # Each collision can involve at most one candidate nucleus
        if candidate_nuclei > 0 and rng.random() < probability:
            product_nuclei += 1

    return BatchResult(
        collisions=collisions,
        candidate_nuclei=candidate_nuclei,
        product_nuclei=product_nuclei,
    )


def split_integer(value, parts):
    base, remainder = divmod(value, parts)
    return [
        base + (1 if index < remainder else 0)
        for index in range(parts)
    ]


def main():
    parser = argparse.ArgumentParser(
        description="Didactic nuclear transmutation simulation"
    )

    parser.add_argument(
        "--source-nuclide",
        default=DEFAULT_SOURCE_NUCLIDE,
        help="label of the source nuclide"
    )

    parser.add_argument(
        "--product-nuclide",
        default=DEFAULT_PRODUCT_NUCLIDE,
        help="label of the product nuclide"
    )

    parser.add_argument(
        "--source-mass-g",
        type=float,
        default=DEFAULT_SOURCE_MASS_G,
        help="theoretical initial target mass in grams"
    )

    parser.add_argument(
        "--source-fraction",
        type=float,
        default=DEFAULT_SOURCE_FRACTION,
        help="fraction of the source nuclide in the target"
    )

    parser.add_argument(
        "--source-molar-mass-g",
        type=float,
        default=DEFAULT_SOURCE_MOLAR_MASS_G,
        help="molar mass of the source nuclide in g/mol"
    )

    parser.add_argument(
        "--product-molar-mass-g",
        type=float,
        default=DEFAULT_PRODUCT_MOLAR_MASS_G,
        help="molar mass of the product nuclide in g/mol"
    )

    parser.add_argument(
        "--collisions",
        type=int,
        default=100_000,
        help="number of virtual collisions"
    )

    parser.add_argument(
        "--probability",
        type=float,
        default=0.0001,
        help=(
            "didactic per-collision probability; "
            "not the real probability of an accelerator"
        )
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=os.cpu_count() or 1,
        help="number of parallel processes"
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="random seed for reproducible results"
    )

    parser.add_argument(
        "--lang",
        choices=SUPPORTED_LANGS,
        default="en",
        help=(
            "language for the UI and text output: "
            "en, it, pt, es, de, zh, ja, fr (default: en)"
        )
    )

    parser.add_argument(
        "--cli",
        action="store_true",
        help="run in text-only mode, without the graphical view"
    )

    args = parser.parse_args()
    lang = args.lang

    if not args.source_nuclide.strip():
        raise SystemExit(cli_t(lang, "err_source_empty"))

    if not args.product_nuclide.strip():
        raise SystemExit(cli_t(lang, "err_product_empty"))

    if args.source_mass_g <= 0:
        raise SystemExit(cli_t(lang, "err_mass"))

    if not 0 < args.source_fraction <= 1:
        raise SystemExit(cli_t(lang, "err_fraction"))

    if args.source_molar_mass_g <= 0:
        raise SystemExit(cli_t(lang, "err_source_molar"))

    if args.product_molar_mass_g <= 0:
        raise SystemExit(cli_t(lang, "err_product_molar"))

    if args.collisions < 1:
        raise SystemExit(cli_t(lang, "err_collisions"))

    if not 0 <= args.probability <= 1:
        raise SystemExit(cli_t(lang, "err_probability"))

    if args.workers < 1:
        raise SystemExit(cli_t(lang, "err_workers"))

    if not args.cli:
        launch_gui(args)
        return

    source_mass_g = args.source_mass_g * args.source_fraction

    source_nuclei = int(
        source_mass_g / args.source_molar_mass_g * AVOGADRO
    )

    workers = min(args.workers, args.collisions)
    collision_batches = split_integer(args.collisions, workers)

    jobs = [
        (
            batch_size,
            source_nuclei,
            args.probability,
            args.seed + index,
        )
        for index, batch_size in enumerate(collision_batches)
    ]

    with ProcessPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(simulate_batch, jobs))

    product_nuclei = sum(result.product_nuclei for result in results)
    expected_product = args.collisions * args.probability

    product_mass_g = (
        product_nuclei
        * args.product_molar_mass_g
        / AVOGADRO
    )

    remaining_source = max(source_nuclei - product_nuclei, 0)
    converted_fraction = (
        product_nuclei / source_nuclei
        if source_nuclei
        else 0.0
    )

    print(cli_t(lang, "title", source=args.source_nuclide, product=args.product_nuclide))
    print()
    print(cli_t(lang, "source_nuclide", value=args.source_nuclide))
    print(cli_t(lang, "product_nuclide", value=args.product_nuclide))
    print(cli_t(lang, "target_mass", value=f"{args.source_mass_g:.6g}"))
    print(cli_t(lang, "source_fraction", value=f"{args.source_fraction:.6g}"))
    print(cli_t(lang, "source_mass", value=f"{source_mass_g:.6g}"))
    print(cli_t(lang, "source_nuclei", value=f"{source_nuclei:,}"))
    print()
    print(cli_t(lang, "collisions", value=f"{args.collisions:,}"))
    print(cli_t(lang, "workers", value=f"{workers}"))
    print(cli_t(lang, "probability", value=f"{args.probability:.6g}"))
    print(cli_t(lang, "expected", value=f"{expected_product:.6g}"))
    print(cli_t(lang, "simulated", value=f"{product_nuclei:,}"))
    print(cli_t(lang, "misses", value=f"{args.collisions - product_nuclei:,}"))
    print()
    print(cli_t(lang, "remaining", value=f"{remaining_source:,}"))
    print(cli_t(lang, "converted", value=f"{converted_fraction:.6e}"))
    print(cli_t(lang, "product_mass", value=f"{product_mass_g:.6e}"))
    print()
    print(cli_t(lang, "warning"))
    print(cli_t(lang, "warn_collision"))
    print(cli_t(lang, "warn_nuclei"))
    print(cli_t(lang, "warn_probability"))
    print(cli_t(lang, "warn_mass"))


def launch_gui(args):
    web_dir = Path(__file__).resolve().parent / "web"
    query = urlencode(
        {
            "source_nuclide": args.source_nuclide,
            "product_nuclide": args.product_nuclide,
            "source_mass_g": args.source_mass_g,
            "source_fraction": args.source_fraction,
            "source_molar_mass_g": args.source_molar_mass_g,
            "product_molar_mass_g": args.product_molar_mass_g,
            "collisions": args.collisions,
            "probability": args.probability,
            "seed": args.seed,
            "lang": args.lang,
        }
    )

    handler = partial(SimpleHTTPRequestHandler, directory=str(web_dir))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/index.html?{query}"

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print(cli_t(args.lang, "gui_title"))
    print(cli_t(args.lang, "gui_url", url=url))
    print(cli_t(args.lang, "gui_stop"))
    webbrowser.open(url)

    try:
        thread.join()
    except KeyboardInterrupt:
        print("\n" + cli_t(args.lang, "gui_interrupted"))
        server.shutdown()


if __name__ == "__main__":
    main()
