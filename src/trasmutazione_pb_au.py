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
PB208_MOLAR_MASS_G = 207.9766525
AU205_MOLAR_MASS_G = 204.974


@dataclass
class BatchResult:
    collisions: int
    candidate_nuclei: int
    gold_nuclei: int


def simulate_batch(args):
    collisions, candidate_nuclei, probability, seed = args
    rng = random.Random(seed)

    gold_nuclei = 0

    for _ in range(collisions):
        # Ogni collisione può coinvolgere al massimo un nucleo candidato
        if candidate_nuclei > 0 and rng.random() < probability:
            gold_nuclei += 1

    return BatchResult(
        collisions=collisions,
        candidate_nuclei=candidate_nuclei,
        gold_nuclei=gold_nuclei,
    )


def split_integer(value, parts):
    base, remainder = divmod(value, parts)
    return [
        base + (1 if index < remainder else 0)
        for index in range(parts)
    ]


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Simulazione didattica della trasmutazione "
            "208Pb -> 205Au"
        )
    )

    parser.add_argument(
        "--lead-mass-g",
        type=float,
        default=100.0,
        help="massa teorica iniziale di piombo in grammi"
    )

    parser.add_argument(
        "--pb208-fraction",
        type=float,
        default=0.524,
        help="frazione teorica di Pb-208 nel piombo naturale"
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
            "non è la probabilità reale dell'LHC"
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

    if args.lead_mass_g <= 0:
        raise SystemExit("La massa di piombo deve essere positiva")

    if not 0 < args.pb208_fraction <= 1:
        raise SystemExit("La frazione di Pb-208 deve essere tra 0 e 1")

    if args.collisions < 1:
        raise SystemExit("Il numero di collisioni deve essere positivo")

    if not 0 <= args.probability <= 1:
        raise SystemExit("La probabilità deve essere tra 0 e 1")

    if args.workers < 1:
        raise SystemExit("Il numero di worker deve essere positivo")

    if not args.cli:
        launch_gui(args)
        return

    pb208_mass_g = args.lead_mass_g * args.pb208_fraction

    pb208_nuclei = int(
        pb208_mass_g / PB208_MOLAR_MASS_G * AVOGADRO
    )

    workers = min(args.workers, args.collisions)
    collision_batches = split_integer(args.collisions, workers)

    jobs = [
        (
            batch_size,
            pb208_nuclei,
            args.probability,
            args.seed + index,
        )
        for index, batch_size in enumerate(collision_batches)
    ]

    with ProcessPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(simulate_batch, jobs))

    gold_nuclei = sum(result.gold_nuclei for result in results)
    expected_gold = args.collisions * args.probability

    gold_mass_g = (
        gold_nuclei
        * AU205_MOLAR_MASS_G
        / AVOGADRO
    )

    remaining_pb208 = max(pb208_nuclei - gold_nuclei, 0)
    converted_fraction = (
        gold_nuclei / pb208_nuclei
        if pb208_nuclei
        else 0.0
    )

    print("=== Simulazione didattica Pb-208 -> Au-205 ===")
    print()
    print(f"Massa teorica iniziale di piombo: {args.lead_mass_g:.6g} g")
    print(f"Frazione teorica di Pb-208: {args.pb208_fraction:.6g}")
    print(f"Massa teorica di Pb-208: {pb208_mass_g:.6g} g")
    print(f"Nuclei teorici di Pb-208 disponibili: {pb208_nuclei:,}")
    print()
    print(f"Collisioni virtuali: {args.collisions:,}")
    print(f"Processi paralleli: {workers}")
    print(f"Probabilità didattica: {args.probability:.6g}")
    print(f"Eventi attesi Pb -> Au: {expected_gold:.6g}")
    print(f"Eventi Pb -> Au simulati: {gold_nuclei:,}")
    print(f"Eventi senza trasmutazione: {args.collisions - gold_nuclei:,}")
    print()
    print(f"Nuclei Pb-208 rimanenti: {remaining_pb208:,}")
    print(f"Frazione teorica convertita: {converted_fraction:.6e}")
    print(f"Massa equivalente simulata di Au-205: {gold_mass_g:.6e} g")
    print()
    print("AVVERTENZA:")
    print("- nessuna collisione reale è avvenuta")
    print("- non è stato prodotto oro reale")
    print("- la probabilità è puramente didattica")
    print("- la massa iniziale è un parametro del modello")


def launch_gui(args):
    web_dir = Path(__file__).resolve().parent / "web"
    query = urlencode(
        {
            "lead_mass_g": args.lead_mass_g,
            "pb208_fraction": args.pb208_fraction,
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

    print("=== Simulazione didattica Pb-208 -> Au-205 ===")
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