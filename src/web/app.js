const AVOGADRO = 6.02214076e23;
const DEFAULT_SOURCE_NUCLIDE = "208Pb";
const DEFAULT_PRODUCT_NUCLIDE = "205Au";
const DEFAULT_SOURCE_MOLAR_MASS_G = 207.9766525;
const DEFAULT_PRODUCT_MOLAR_MASS_G = 204.974;

currentLang = detectLang();
applyI18n();

const params = readParams();
const els = {
  canvas: document.getElementById("chamber"),
  speed: document.getElementById("speed"),
  lang: document.getElementById("lang"),
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
  form: document.getElementById("params-form"),
  error: document.getElementById("params-error"),
};

const reaction = `${params.sourceNuclide} → ${params.productNuclide}`;
document.title = t("doc_title", { reaction });
document.getElementById("reaction-title").textContent = reaction;
els.canvas.setAttribute("aria-label", t("chamber_aria"));
els.lang.value = currentLang;

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
    phase: t("phase_setup"),
    title: t("setup_read_title"),
    formula: t("setup_read_formula", {
      source: params.sourceNuclide,
      product: params.productNuclide,
      mass: fmt(params.sourceMassG),
      fraction: fmt(params.sourceFraction),
      collisions: fmtCount(params.collisions),
      probability: fmt(params.probability),
      seed: params.seed,
    }),
    result: t("setup_read_result"),
    log: t("setup_read_log"),
  },
  {
    phase: t("phase_setup"),
    title: t("setup_mass_title"),
    formula: t("setup_mass_formula", {
      mass: fmt(params.sourceMassG),
      fraction: fmt(params.sourceFraction),
    }),
    result: t("setup_mass_result", { source: params.sourceNuclide, value: fmt(sourceMass) }),
    log: t("setup_mass_log", { source: params.sourceNuclide, value: fmt(sourceMass) }),
  },
  {
    phase: t("phase_setup"),
    title: t("setup_nuclei_title"),
    formula: t("setup_nuclei_formula", {
      mass: fmt(sourceMass),
      molar: params.sourceMolarMassG,
      avogadro: AVOGADRO.toExponential(8),
    }),
    result: t("setup_nuclei_result", { source: params.sourceNuclide, value: fmtSci(sourceNuclei) }),
    log: t("setup_nuclei_log", { source: params.sourceNuclide, value: fmtSci(sourceNuclei) }),
  },
  {
    phase: t("phase_setup"),
    title: t("setup_expected_title"),
    formula: t("setup_expected_formula", {
      collisions: fmtCount(params.collisions),
      probability: fmt(params.probability),
    }),
    result: t("setup_expected_result", { value: fmt(expectedProduct) }),
    log: t("setup_expected_log", { value: fmt(expectedProduct) }),
  },
  {
    phase: t("phase_setup"),
    title: t("setup_start_title"),
    formula: t("setup_start_formula"),
    result: t("setup_start_result", { reaction }),
    log: t("setup_start_log"),
  },
];

els.expected.textContent = fmt(expectedProduct);
fillForm(params);
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  applyForm();
});
els.lang.addEventListener("change", () => {
  const query = currentQuery();
  query.set("lang", els.lang.value);
  window.location.search = query.toString();
});
els.pause.addEventListener("click", () => {
  state.paused = !state.paused;
  els.pause.textContent = state.paused ? t("resume") : t("pause");
});
els.restart.addEventListener("click", () => window.location.reload());
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  const tag = event.target && event.target.tagName;
  if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
  event.preventDefault();
  els.pause.click();
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
          t("phase_collision"),
          t("first_draw_title"),
          t("first_draw_formula"),
          t("first_draw_result"),
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
        t("collision_hit_log", {
          index: fmtCount(index),
          u: u.toFixed(8),
          product: params.productNuclide,
        }),
        "gold",
      );
      addGold(index, u);
    }
    last = { index, u, success };
    state.collision += 1;
    if (!success && Number(els.speed.value) <= 8) {
      logLine(
        t("collision_miss_log", { index: fmtCount(index), u: u.toFixed(8) }),
        "miss",
      );
    }
  }

  if (last) {
    const productMass = state.gold * params.productMolarMassG / AVOGADRO;
    setOp(
      t("phase_collision"),
      t("collision_title", { index: fmtCount(last.index) }),
      t("collision_formula", {
        u: last.u.toFixed(8),
        p: params.probability,
        answer: last.success ? t("yes") : t("no"),
      }),
      last.success ? t("didactic_transmutation", { reaction }) : t("no_transmutation"),
      last.success ? "gold" : "ok",
    );
    els.collisions.textContent = fmtCount(last.index);
    els.gold.textContent = fmtCount(state.gold);
    els.mass.textContent = `${productMass.toExponential(4)} g`;
    els.progress.style.width = `${(state.collision / params.collisions) * 100}%`;
    if (
      !last.success
      && Number(els.speed.value) > 8
      && last.index % Math.max(1, Math.floor(params.collisions / 20)) === 0
    ) {
      logLine(t("collision_miss_short", { index: fmtCount(last.index) }), "miss");
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
    t("phase_results"),
    t("results_title"),
    t("results_formula", {
      simulated: fmtCount(state.gold),
      expected: fmt(expectedProduct),
      source: params.sourceNuclide,
      remaining: fmtSci(remainingSource),
      converted: converted.toExponential(6),
      product: params.productNuclide,
      mass: productMass.toExponential(6),
    }),
    t("no_real_nuclei"),
    "gold",
  );
  logLine(t("events_simulated_log", { value: fmtCount(state.gold) }), "gold");
  logLine(
    t("equivalent_mass_log", {
      product: params.productNuclide,
      mass: productMass.toExponential(6),
    }),
    "setup",
  );
  logLine(t("didactic_warning_log"), "miss");
}

function showSetupOp(op, writeLog) {
  setOp(op.phase, op.title, op.formula, op.result);
  if (writeLog) logLine(op.log, "setup");
}

function setOp(phase, title, formula, result, tone) {
  els.phase.textContent = phase;
  els.title.textContent = title;
  els.formula.textContent = formula;
  els.result.textContent = result;
  els.result.style.color = tone === "gold" ? "#e2b340" : "#7ddeb0";
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
  li.textContent = `#${fmtCount(index)}  u=${u.toFixed(8)}`;
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
  ctx.fillText(t("virtual_beam"), -248, -18);
  ctx.fillText(t("target_label", { source: params.sourceNuclide }), 48, -18);
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

function fillForm(values) {
  const fields = els.form.elements;
  fields.source_nuclide.value = values.sourceNuclide;
  fields.product_nuclide.value = values.productNuclide;
  fields.source_mass_g.value = values.sourceMassG;
  fields.source_fraction.value = values.sourceFraction;
  fields.source_molar_mass_g.value = values.sourceMolarMassG;
  fields.product_molar_mass_g.value = values.productMolarMassG;
  fields.collisions.value = values.collisions;
  fields.probability.value = values.probability;
  fields.seed.value = values.seed;
}

function readForm() {
  const fields = els.form.elements;
  return {
    sourceNuclide: fields.source_nuclide.value.trim(),
    productNuclide: fields.product_nuclide.value.trim(),
    sourceMassG: Number(fields.source_mass_g.value),
    sourceFraction: Number(fields.source_fraction.value),
    sourceMolarMassG: Number(fields.source_molar_mass_g.value),
    productMolarMassG: Number(fields.product_molar_mass_g.value),
    collisions: Number(fields.collisions.value),
    probability: Number(fields.probability.value),
    seed: Number(fields.seed.value),
  };
}

function validateParams(values) {
  if (!values.sourceNuclide) return t("err_source_empty");
  if (!values.productNuclide) return t("err_product_empty");
  if (!(values.sourceMassG > 0)) return t("err_mass");
  if (!(values.sourceFraction > 0 && values.sourceFraction <= 1)) return t("err_fraction");
  if (!(values.sourceMolarMassG > 0)) return t("err_source_molar");
  if (!(values.productMolarMassG > 0)) return t("err_product_molar");
  if (!(Number.isInteger(values.collisions) && values.collisions >= 1)) return t("err_collisions");
  if (!(values.probability >= 0 && values.probability <= 1)) return t("err_probability");
  if (!Number.isInteger(values.seed)) return t("err_seed");
  return "";
}

function currentQuery() {
  const values = readForm();
  return new URLSearchParams({
    source_nuclide: values.sourceNuclide || params.sourceNuclide,
    product_nuclide: values.productNuclide || params.productNuclide,
    source_mass_g: String(values.sourceMassG || params.sourceMassG),
    source_fraction: String(values.sourceFraction || params.sourceFraction),
    source_molar_mass_g: String(values.sourceMolarMassG || params.sourceMolarMassG),
    product_molar_mass_g: String(values.productMolarMassG || params.productMolarMassG),
    collisions: String(values.collisions || params.collisions),
    probability: String(Number.isFinite(values.probability) ? values.probability : params.probability),
    seed: String(Number.isInteger(values.seed) ? values.seed : params.seed),
    lang: currentLang,
  });
}

function applyForm() {
  const values = readForm();
  const error = validateParams(values);
  els.error.hidden = !error;
  els.error.textContent = error;
  if (error) return;

  const query = new URLSearchParams({
    source_nuclide: values.sourceNuclide,
    product_nuclide: values.productNuclide,
    source_mass_g: String(values.sourceMassG),
    source_fraction: String(values.sourceFraction),
    source_molar_mass_g: String(values.sourceMolarMassG),
    product_molar_mass_g: String(values.productMolarMassG),
    collisions: String(values.collisions),
    probability: String(values.probability),
    seed: String(values.seed),
    lang: currentLang,
  });
  window.location.search = query.toString();
}

function fmt(value) {
  const number = Number(value);
  if (Math.abs(number) >= 1e6 || (Math.abs(number) > 0 && Math.abs(number) < 1e-3)) {
    return number.toExponential(4);
  }
  return new Intl.NumberFormat(localeForLang(), { maximumFractionDigits: 6 }).format(number);
}

function fmtCount(value) {
  return Number(value).toLocaleString(localeForLang());
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
