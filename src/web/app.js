const AVOGADRO = 6.02214076e23;
const DEFAULT_SOURCE_NUCLIDE = "208Pb";
const DEFAULT_PRODUCT_NUCLIDE = "205Au";
const DEFAULT_SOURCE_MOLAR_MASS_G = 207.9766525;
const DEFAULT_PRODUCT_MOLAR_MASS_G = 204.974;

const params = readParams();
const els = {
  canvas: document.getElementById("chamber"),
  speed: document.getElementById("speed"),
  pause: document.getElementById("pause"),
  restart: document.getElementById("restart"),
  collisions: document.getElementById("stat-collisions"),
  gold: document.getElementById("stat-gold"),
  expected: document.getElementById("stat-expected"),
  mass: document.getElementById("stat-mass"),
  progress: document.getElementById("progress"),
  phase: document.querySelector(".op-phase"),
  title: document.getElementById("op-title"),
  formula: document.getElementById("op-formula"),
  result: document.getElementById("op-result"),
  log: document.getElementById("log"),
  golds: document.getElementById("golds"),
};

const reaction = `${params.sourceNuclide} → ${params.productNuclide}`;
document.title = `Simulazione didattica ${reaction}`;
document.getElementById("reaction-title").textContent = reaction;

const ctx = els.canvas.getContext("2d");
const rng = mulberry32(params.seed);

const state = {
  phase: "setup",
  setupIndex: 0,
  collision: 0,
  gold: 0,
  paused: false,
  lastTs: 0,
  setupAcc: 0,
  runAcc: 0,
  particles: [],
  flashes: [],
  nuclei: makeNuclei(42),
};

const sourceMass = params.sourceMassG * params.sourceFraction;
const sourceNuclei = Math.floor(sourceMass / params.sourceMolarMassG * AVOGADRO);
const expectedProduct = params.collisions * params.probability;

const setupOps = [
  {
    phase: "Setup",
    title: "Lettura parametri",
    formula: `nuclide di partenza = ${params.sourceNuclide}\nnuclide di arrivo = ${params.productNuclide}\nmassa bersaglio = ${fmt(params.sourceMassG)} g\nfrazione del nuclide di partenza = ${fmt(params.sourceFraction)}\ncollisioni = ${params.collisions.toLocaleString("it-IT")}\nprobabilità didattica = ${fmt(params.probability)}\nseme = ${params.seed}`,
    result: "Parametri caricati nel modello",
    log: "Parametri di ingresso acquisiti",
  },
  {
    phase: "Setup",
    title: "Calcolo massa del nuclide di partenza",
    formula: "m(sorgente) = massa bersaglio × frazione\n"
      + `${fmt(params.sourceMassG)} × ${fmt(params.sourceFraction)}`,
    result: `m(${params.sourceNuclide}) = ${fmt(sourceMass)} g`,
    log: `Massa teorica ${params.sourceNuclide}: ${fmt(sourceMass)} g`,
  },
  {
    phase: "Setup",
    title: "Calcolo nuclei candidati",
    formula: "N = m / M × N_A\n"
      + `${fmt(sourceMass)} / ${params.sourceMolarMassG} × ${AVOGADRO.toExponential(8)}`,
    result: `N(${params.sourceNuclide}) = ${fmtSci(sourceNuclei)}`,
    log: `Nuclei teorici di ${params.sourceNuclide}: ${fmtSci(sourceNuclei)}`,
  },
  {
    phase: "Setup",
    title: "Valore atteso",
    formula: "eventi attesi = collisioni × probabilità\n"
      + `${params.collisions.toLocaleString("it-IT")} × ${fmt(params.probability)}`,
    result: `eventi attesi = ${fmt(expectedProduct)}`,
    log: `Eventi attesi: ${fmt(expectedProduct)}`,
  },
  {
    phase: "Setup",
    title: "Avvio collisioni virtuali",
    formula: "per ogni collisione:\n  u ~ Uniforme(0, 1)\n  se u < p e restano nuclei candidati\n    sorgente → prodotto",
    result: `Registro ogni estrazione, il confronto con p e l'esito ${reaction}`,
    log: "Inizio del ciclo Monte Carlo visibile",
  },
];

els.expected.textContent = fmt(expectedProduct);
els.pause.addEventListener("click", () => {
  state.paused = !state.paused;
  els.pause.textContent = state.paused ? "Riprendi" : "Pausa";
});
els.restart.addEventListener("click", () => window.location.reload());
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    els.pause.click();
  }
});
window.addEventListener("resize", fitCanvas);
fitCanvas();
showSetupOp(setupOps[0], false);
requestAnimationFrame(frame);

function frame(ts) {
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000 || 0.016);
  state.lastTs = ts;
  if (!state.paused) step(dt);
  draw();
  requestAnimationFrame(frame);
}

function step(dt) {
  if (state.phase === "setup") {
    state.setupAcc += dt;
    if (state.setupAcc >= 1.15) {
      state.setupAcc = 0;
      logLine(setupOps[state.setupIndex].log, "setup");
      state.setupIndex += 1;
      if (state.setupIndex >= setupOps.length) {
        state.phase = "running";
        setOp(
          "Collisione",
          "Prima estrazione casuale",
          "u ~ Uniforme(0, 1)\nconfronto con p didattica",
          "In attesa della collisione 1",
        );
      } else {
        showSetupOp(setupOps[state.setupIndex], false);
      }
    }
    spawnBeam(dt, 18);
  } else if (state.phase === "running") {
    const perSecond = Number(els.speed.value);
    state.runAcc += perSecond * dt;
    const todo = Math.floor(state.runAcc);
    state.runAcc -= todo;
    if (todo > 0) runCollisions(todo);
    spawnBeam(dt, Math.min(90, 18 + Math.sqrt(perSecond)));
  } else {
    spawnBeam(dt, 8);
  }

  updateParticles(dt);
}

function runCollisions(count) {
  let last = null;
  const remaining = params.collisions - state.collision;
  const n = Math.min(count, remaining);
  for (let i = 0; i < n; i += 1) {
    const index = state.collision + 1;
    const u = rng();
    const success = sourceNuclei > 0 && u < params.probability;
    if (success) {
      state.gold += 1;
      convertNucleus();
      state.flashes.push({ t: 0, gold: true });
      logLine(
        `Collisione ${index.toLocaleString("it-IT")}: u=${u.toFixed(8)} < p → ${params.productNuclide}`,
        "gold",
      );
      addGold(index, u);
    }
    last = { index, u, success };
    state.collision += 1;
    if (!success && Number(els.speed.value) <= 8) {
      logLine(
        `Collisione ${index.toLocaleString("it-IT")}: u=${u.toFixed(8)} ≥ p → nessuna trasmutazione`,
        "miss",
      );
    }
  }

  if (last) {
    const productMass = state.gold * params.productMolarMassG / AVOGADRO;
    setOp(
      "Collisione",
      `Collisione ${last.index.toLocaleString("it-IT")}`,
      `u = ${last.u.toFixed(8)}\np = ${params.probability}\nu < p ? ${last.success ? "sì" : "no"}`,
      last.success
        ? `Trasmutazione didattica ${reaction}`
        : "Nessuna trasmutazione",
    );
    els.collisions.textContent = last.index.toLocaleString("it-IT");
    els.gold.textContent = state.gold.toLocaleString("it-IT");
    els.mass.textContent = `${productMass.toExponential(4)} g`;
    els.progress.style.width = `${(state.collision / params.collisions) * 100}%`;
    if (
      !last.success
      && Number(els.speed.value) > 8
      && last.index % Math.max(1, Math.floor(params.collisions / 20)) === 0
    ) {
      logLine(
        `Collisione ${last.index.toLocaleString("it-IT")}: nessuna trasmutazione`,
        "miss",
      );
    }
  }

  if (state.collision >= params.collisions) {
    finish();
  }
}

function finish() {
  state.phase = "done";
  const productMass = state.gold * params.productMolarMassG / AVOGADRO;
  const remainingSource = Math.max(sourceNuclei - state.gold, 0);
  const converted = sourceNuclei ? state.gold / sourceNuclei : 0;
  setOp(
    "Risultati",
    "Chiusura della simulazione",
    `eventi simulati = ${state.gold.toLocaleString("it-IT")}\n`
      + `eventi attesi = ${fmt(expectedProduct)}\n`
      + `${params.sourceNuclide} rimanenti = ${fmtSci(remainingSource)}\n`
      + `frazione convertita = ${converted.toExponential(6)}\n`
      + `massa ${params.productNuclide} = ${productMass.toExponential(6)} g`,
    "Nessun nuclide reale è stato prodotto",
  );
  logLine(`Eventi simulati: ${state.gold.toLocaleString("it-IT")}`, "gold");
  logLine(`Massa equivalente di ${params.productNuclide}: ${productMass.toExponential(6)} g`, "setup");
  logLine("Avvertenza: modello puramente didattico", "miss");
}

function showSetupOp(op, writeLog) {
  setOp(op.phase, op.title, op.formula, op.result);
  if (writeLog) logLine(op.log, "setup");
}

function setOp(phase, title, formula, result) {
  els.phase.textContent = phase;
  els.title.textContent = title;
  els.formula.textContent = formula;
  els.result.textContent = result;
  els.result.style.color = phase === "Risultati" || result.includes("Trasmutazione")
    ? "#e2b340"
    : "#7ddeb0";
}

function logLine(text, kind) {
  const li = document.createElement("li");
  li.textContent = text;
  li.className = kind;
  els.log.prepend(li);
  while (els.log.children.length > 80) els.log.lastChild.remove();
}

function addGold(index, u) {
  if (els.golds.querySelector(".empty")) els.golds.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = `#${index.toLocaleString("it-IT")}  u=${u.toFixed(8)}`;
  els.golds.prepend(li);
}

function makeNuclei(count) {
  const nuclei = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const radius = 18 + (i % 5) * 7;
    nuclei.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      gold: false,
      r: 4 + (i % 3),
    });
  }
  return nuclei;
}

function convertNucleus() {
  const source = state.nuclei.find((nucleus) => !nucleus.gold);
  if (source) source.gold = true;
}

function spawnBeam(dt, rate) {
  const n = Math.max(0, Math.round(rate * dt));
  for (let i = 0; i < n; i += 1) {
    state.particles.push({
      x: -210,
      y: (Math.random() - 0.5) * 16,
      vx: 220 + Math.random() * 80,
      vy: (Math.random() - 0.5) * 12,
      life: 1,
      gold: false,
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (particle.x > -12 && particle.x < 18) {
      particle.vy += (Math.random() - 0.5) * 40 * dt;
      particle.life -= dt * 0.35;
    }
    if (particle.x > 40) particle.life -= dt * 1.8;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0 && particle.x < 230);
  for (const flash of state.flashes) flash.t += dt;
  state.flashes = state.flashes.filter((flash) => flash.t < 0.6);
}

function draw() {
  const { width, height } = els.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  const scale = Math.min(width, height) / 520;
  ctx.scale(scale, scale);

  ctx.strokeStyle = "#2c3648";
  ctx.lineWidth = 2;
  for (const radius of [90, 140, 190, 240]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#3d4a5f";
  ctx.beginPath();
  ctx.moveTo(-250, 0);
  ctx.lineTo(250, 0);
  ctx.stroke();

  for (const flash of state.flashes) {
    ctx.beginPath();
    ctx.arc(0, 0, 20 + flash.t * 180, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(226, 179, 64, ${1 - flash.t / 0.6})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (const nucleus of state.nuclei) {
    ctx.beginPath();
    ctx.arc(nucleus.x, nucleus.y, nucleus.r, 0, Math.PI * 2);
    ctx.fillStyle = nucleus.gold ? "#e2b340" : "#9aa4b2";
    ctx.fill();
  }

  for (const particle of state.particles) {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(110, 196, 255, ${particle.life})`;
    ctx.fill();
  }

  ctx.fillStyle = "#e7edf6";
  ctx.font = "12px Menlo, monospace";
  ctx.fillText("fascio virtuale", -248, -18);
  ctx.fillText(`bersaglio ${params.sourceNuclide}`, 48, -18);
  ctx.restore();
}

function fitCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(640, rect.width) * dpr;
  els.canvas.height = Math.max(420, rect.height) * dpr;
}

function readParams() {
  const query = new URLSearchParams(window.location.search);
  return {
    sourceNuclide: query.get("source_nuclide") || DEFAULT_SOURCE_NUCLIDE,
    productNuclide: query.get("product_nuclide") || DEFAULT_PRODUCT_NUCLIDE,
    sourceMassG: Number(query.get("source_mass_g") || 100),
    sourceFraction: Number(query.get("source_fraction") || 0.524),
    sourceMolarMassG: Number(query.get("source_molar_mass_g") || DEFAULT_SOURCE_MOLAR_MASS_G),
    productMolarMassG: Number(query.get("product_molar_mass_g") || DEFAULT_PRODUCT_MOLAR_MASS_G),
    collisions: Number(query.get("collisions") || 100000),
    probability: Number(query.get("probability") || 0.0001),
    seed: Number(query.get("seed") || 42),
  };
}

function fmt(value) {
  const number = Number(value);
  if (Math.abs(number) >= 1e6 || (Math.abs(number) > 0 && Math.abs(number) < 1e-3)) {
    return number.toExponential(4);
  }
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(number);
}

function fmtSci(value) {
  return Number(value).toExponential(4);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
