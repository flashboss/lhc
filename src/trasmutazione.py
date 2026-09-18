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


AVOGADRO = 6.02214076e23
DEFAULT_SOURCE_NUCLIDE = "208Pb"
DEFAULT_PRODUCT_NUCLIDE = "205Au"
DEFAULT_SOURCE_MOLAR_MASS_G = 207.9766525
DEFAULT_PRODUCT_MOLAR_MASS_G = 204.974
DEFAULT_SOURCE_MASS_G = 100.0
DEFAULT_SOURCE_FRACTION = 0.524


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
        # Ogni collisione può coinvolgere al massimo un nucleo candidato
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
        description="Simulazione didattica di trasmutazione nucleare"
    )

    parser.add_argument(
        "--source-nuclide",
        default=DEFAULT_SOURCE_NUCLIDE,
        help="etichetta del nuclide di partenza"
    )

    parser.add_argument(
        "--product-nuclide",
        default=DEFAULT_PRODUCT_NUCLIDE,
        help="etichetta del nuclide di arrivo"
    )

    parser.add_argument(
        "--source-mass-g",
        type=float,
        default=DEFAULT_SOURCE_MASS_G,
        help="massa teorica iniziale del bersaglio in grammi"
    )

    parser.add_argument(
        "--source-fraction",
        type=float,
        default=DEFAULT_SOURCE_FRACTION,
        help="frazione del nuclide di partenza nel bersaglio"
    )

    parser.add_argument(
        "--source-molar-mass-g",
        type=float,
        default=DEFAULT_SOURCE_MOLAR_MASS_G,
        help="massa molare del nuclide di partenza in g/mol"
    )

    parser.add_argument(
        "--product-molar-mass-g",
        type=float,
        default=DEFAULT_PRODUCT_MOLAR_MASS_G,
        help="massa molare del nuclide di arrivo in g/mol"
    )

    parser.add_argument(
        "--collisions",
        type=int,
        default=100_000,
        help="numero di collisioni virtuali"
    )

    parser.add_argument(
        "--probability",
        type=float,
        default=0.0001,
        help=(
            "probabilità didattica per collisione; "
            "non è la probabilità reale di un acceleratore"
        )
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=os.cpu_count() or 1,
        help="numero di processi paralleli"
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="seme casuale per risultati riproducibili"
    )

    parser.add_argument(
        "--cli",
        action="store_true",
        help="esegui solo in modalità testuale, senza finestra grafica"
    )

    args = parser.parse_args()

    if not args.source_nuclide.strip():
        raise SystemExit("Il nuclide di partenza non può essere vuoto")

    if not args.product_nuclide.strip():
        raise SystemExit("Il nuclide di arrivo non può essere vuoto")

    if args.source_mass_g <= 0:
        raise SystemExit("La massa del bersaglio deve essere positiva")

    if not 0 < args.source_fraction <= 1:
        raise SystemExit("La frazione del nuclide di partenza deve essere tra 0 e 1")

    if args.source_molar_mass_g <= 0:
        raise SystemExit("La massa molare di partenza deve essere positiva")

    if args.product_molar_mass_g <= 0:
        raise SystemExit("La massa molare di arrivo deve essere positiva")

    if args.collisions < 1:
        raise SystemExit("Il numero di collisioni deve essere positivo")

    if not 0 <= args.probability <= 1:
        raise SystemExit("La probabilità deve essere tra 0 e 1")

    if args.workers < 1:
        raise SystemExit("Il numero di worker deve essere positivo")

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

    print(f"=== Simulazione didattica {args.source_nuclide} -> {args.product_nuclide} ===")
    print()
    print(f"Nuclide di partenza: {args.source_nuclide}")
    print(f"Nuclide di arrivo: {args.product_nuclide}")
    print(f"Massa teorica iniziale del bersaglio: {args.source_mass_g:.6g} g")
    print(f"Frazione del nuclide di partenza: {args.source_fraction:.6g}")
    print(f"Massa teorica del nuclide di partenza: {source_mass_g:.6g} g")
    print(f"Nuclei teorici di partenza disponibili: {source_nuclei:,}")
    print()
    print(f"Collisioni virtuali: {args.collisions:,}")
    print(f"Processi paralleli: {workers}")
    print(f"Probabilità didattica: {args.probability:.6g}")
    print(f"Eventi attesi: {expected_product:.6g}")
    print(f"Eventi simulati: {product_nuclei:,}")
    print(f"Eventi senza trasmutazione: {args.collisions - product_nuclei:,}")
    print()
    print(f"Nuclei di partenza rimanenti: {remaining_source:,}")
    print(f"Frazione teorica convertita: {converted_fraction:.6e}")
    print(f"Massa equivalente simulata del prodotto: {product_mass_g:.6e} g")
    print()
    print("AVVERTENZA:")
    print("- nessuna collisione reale è avvenuta")
    print("- non è stato prodotto alcun nuclide reale")
    print("- la probabilità è puramente didattica")
    print("- la massa iniziale è un parametro del modello")


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
        }
    )

    handler = partial(SimpleHTTPRequestHandler, directory=str(web_dir))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/index.html?{query}"

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print("=== Simulazione didattica di trasmutazione ===")
    print(f"Visualizzazione operazioni: {url}")
    print("Chiudi la finestra del browser o premi Ctrl+C per terminare")
    webbrowser.open(url)

    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nSimulazione grafica interrotta")
        server.shutdown()


if __name__ == "__main__":
    main()
