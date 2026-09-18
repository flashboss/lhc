const AVOGADRO = 6.02214076e23;
const DEFAULT_SOURCE_NUCLIDE = "208Pb";
const DEFAULT_PRODUCT_NUCLIDE = "205Au";
const DEFAULT_SOURCE_MOLAR_MASS_G = 207.9766525;
const DEFAULT_PRODUCT_MOLAR_MASS_G = 204.974;

currentLang = detectLang();
applyI18n();

const params = readParams();
const sourceSpec = parseNuclide(params.sourceNuclide);
const productSpec = parseNuclide(params.productNuclide);
const pModel = isResolvedNuclide(sourceSpec) && isResolvedNuclide(productSpec)
  ? effectiveProbability(params.probability, sourceSpec, productSpec)
  : params.probability;
const nuclearDz = isResolvedNuclide(sourceSpec) && isResolvedNuclide(productSpec)
  ? Math.abs(sourceSpec.z - productSpec.z)
  : 0;
const nuclearDa = isResolvedNuclide(sourceSpec) && isResolvedNuclide(productSpec)
  ? Math.abs(sourceSpec.a - productSpec.a)
  : 0;
const els = {
  canvas: document.getElementById("chamber"),
  ring: document.getElementById("ring"),
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
  opLabel: document.getElementById("op-label"),
  currentOp: document.getElementById("current-op"),
  log: document.getElementById("log"),
  golds: document.getElementById("golds"),
  form: document.getElementById("params-form"),
  error: document.getElementById("params-error"),
  chamberPanel: document.getElementById("chamber-panel"),
  chamberTarget: document.getElementById("view-target-pane"),
  chamberRing: document.getElementById("view-ring-pane"),
  viewTarget: document.getElementById("view-target"),
  viewRing: document.getElementById("view-ring"),
  viewsEmpty: document.getElementById("views-empty"),
  viewMenuWrap: document.getElementById("view-menu-wrap"),
  viewMenuBtn: document.getElementById("view-menu-btn"),
  viewMenu: document.getElementById("view-menu"),
  viewMenuSummary: document.getElementById("view-menu-summary"),
};

const reaction = `${params.sourceNuclide} → ${params.productNuclide}`;
document.title = t("doc_title", { reaction });
document.getElementById("reaction-title").textContent = reaction;
els.canvas.setAttribute("aria-label", t("chamber_aria"));
els.ring.setAttribute("aria-label", t("ring_aria"));
els.lang.value = currentLang;

const ctx = els.canvas.getContext("2d");
const ringCtx = els.ring.getContext("2d");
const rng = mulberry32(params.seed);

const state = {
  phase: "setup",
  setupIndex: 0,
  collision: 0,
  gold: 0,
  paused: false,
  lastTs: 0,
  orbitNow: null,
  setupAcc: 0,
  runAcc: 0,
  particles: [],
  flashes: [],
  nuclei: makeNuclei(42),
  orbiters: makeOrbiters(24),
};

const sourceMass = params.sourceMassG * params.sourceFraction;
const sourceNuclei = Math.floor(sourceMass / params.sourceMolarMassG * AVOGADRO);
const expectedProduct = params.collisions * pModel;

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
      p_model: fmt(pModel),
      source_z: isResolvedNuclide(sourceSpec) ? sourceSpec.z : "?",
      source_a: isResolvedNuclide(sourceSpec) ? sourceSpec.a : "?",
      product_z: isResolvedNuclide(productSpec) ? productSpec.z : "?",
      product_a: isResolvedNuclide(productSpec) ? productSpec.a : "?",
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
      dz: fmtCount(nuclearDz),
      da: fmtCount(nuclearDa),
      p_model: fmt(pModel),
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
fillElementOptions();
fillForm(params);
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  applyForm();
});
els.form.elements.source_element.addEventListener("change", () => onElementChange("source"));
els.form.elements.product_element.addEventListener("change", () => onElementChange("product"));
els.form.elements.source_a.addEventListener("input", () => syncMolarMass("source"));
els.form.elements.product_a.addEventListener("input", () => syncMolarMass("product"));
const initialViews = readViewsParam();
els.viewTarget.checked = initialViews.target;
els.viewRing.checked = initialViews.ring;
els.viewTarget.addEventListener("change", onViewChange);
els.viewRing.addEventListener("change", onViewChange);
els.viewMenuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  setViewMenuOpen(els.viewMenu.hidden);
});
document.addEventListener("click", (event) => {
  if (els.viewMenu.hidden) return;
  if (els.viewMenuWrap.contains(event.target)) return;
  setViewMenuOpen(false);
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
const startupError = validateParams(params);
if (startupError) {
  els.error.hidden = false;
  els.error.textContent = startupError;
  state.paused = true;
  state.phase = "done";
  els.pause.textContent = t("resume");
}
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.viewMenu.hidden) {
    setViewMenuOpen(false);
    els.viewMenuBtn.focus();
    return;
  }
  if (event.code !== "Space") return;
  const tag = event.target && event.target.tagName;
  if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
  event.preventDefault();
  els.pause.click();
});
window.addEventListener("resize", fitCanvas);
syncViews();
if (startupError) {
  setOp(t("phase_setup"), startupError, "", t("no_real_nuclei"));
} else {
  showSetupOp(setupOps[0], false);
}
requestAnimationFrame(frame);

function frame(ts) {
  const elapsed = (ts - state.lastTs) / 1000 || 0.016;
  state.lastTs = ts;
  if (state.paused || state.phase === "done") {
    state.orbitNow = performance.now();
  } else {
    updateOrbiters();
  }
  draw();
  if (!state.paused) step(Math.min(0.05, elapsed));
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
    const todo = Math.min(Math.floor(state.runAcc), 32);
    state.runAcc -= todo;
    if (todo > 0) runCollisions(todo);
    spawnBeam(dt, Math.min(90, 18 + Math.sqrt(perSecond)));
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
    const success = sourceNuclei > 0 && u < pModel;
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
        p: fmt(pModel),
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
    "finished_op",
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

function setOp(phase, title, formula, result, tone, labelKey) {
  els.opLabel.textContent = t(labelKey || "current_op");
  els.currentOp.classList.toggle("is-done", labelKey === "finished_op");
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
      r: nucleusRadius(i),
    });
  }
  return nuclei;
}

function convertNucleus() {
  const source = state.nuclei.find((nucleus) => !nucleus.gold);
  if (source) source.gold = true;
}

function makeOrbiters(count) {
  const orbiters = [];
  const bunches = count / 2;
  for (let i = 0; i < count; i += 1) {
    const inner = i % 2 === 0;
    orbiters.push({
      angle: (Math.PI * 2 * Math.floor(i / 2)) / bunches + (inner ? 0.11 : -0.07),
      dir: inner ? 1 : -1,
      radius: inner ? 192 : 208,
    });
  }
  return orbiters;
}

const RING_OMEGA = [0.6, 1.4, 2.8, 5.5, 9.5];

function updateOrbiters() {
  const now = performance.now();
  if (state.orbitNow == null) state.orbitNow = now;
  const dt = Math.min(0.08, (now - state.orbitNow) / 1000);
  state.orbitNow = now;
  const omega = RING_OMEGA[els.speed.selectedIndex] ?? 1.6;
  for (const orbiter of state.orbiters) {
    orbiter.angle += orbiter.dir * omega * dt;
  }
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
  if (!els.chamberTarget.hidden) drawTarget();
  if (!els.chamberRing.hidden) drawRing();
}

function drawTarget() {
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
    ctx.fillStyle = nucleus.gold ? "#e2b340" : sourceNucleusColor();
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

function drawRing() {
  const { width, height } = els.ring;
  ringCtx.clearRect(0, 0, width, height);
  ringCtx.save();
  ringCtx.translate(width / 2, height / 2);
  const scale = Math.min(width, height) / 520;
  ringCtx.scale(scale, scale);

  ringCtx.strokeStyle = "#2c3648";
  ringCtx.lineWidth = 10;
  ringCtx.beginPath();
  ringCtx.arc(0, 0, 200, 0, Math.PI * 2);
  ringCtx.stroke();

  ringCtx.strokeStyle = "#3d4a5f";
  ringCtx.lineWidth = 2;
  for (const radius of [192, 208]) {
    ringCtx.beginPath();
    ringCtx.arc(0, 0, radius, 0, Math.PI * 2);
    ringCtx.stroke();
  }

  ringCtx.strokeStyle = "#6ec4ff";
  ringCtx.lineWidth = 2;
  ringCtx.beginPath();
  ringCtx.arc(-200, 0, 10, 0, Math.PI * 2);
  ringCtx.stroke();

  for (const flash of state.flashes) {
    ringCtx.beginPath();
    ringCtx.arc(-200, 0, 8 + flash.t * 90, 0, Math.PI * 2);
    ringCtx.strokeStyle = `rgba(226, 179, 64, ${1 - flash.t / 0.6})`;
    ringCtx.lineWidth = 3;
    ringCtx.stroke();
  }

  for (const orbiter of state.orbiters) {
    const x = Math.cos(orbiter.angle) * orbiter.radius;
    const y = Math.sin(orbiter.angle) * orbiter.radius;
    ringCtx.beginPath();
    ringCtx.arc(x, y, 2.4, 0, Math.PI * 2);
    ringCtx.fillStyle = orbiter.dir > 0 ? "rgba(110, 196, 255, 0.95)" : "rgba(226, 179, 64, 0.8)";
    ringCtx.fill();
  }

  ringCtx.fillStyle = "#e7edf6";
  ringCtx.font = "12px Menlo, monospace";
  ringCtx.textAlign = "center";
  ringCtx.textBaseline = "middle";
  ringCtx.fillText(t("virtual_ring"), 0, 0);
  ringCtx.restore();
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  for (const canvas of [els.canvas, els.ring]) {
    if (canvas.closest("[hidden]")) continue;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
}

function nucleusRadius(index) {
  const a = isResolvedNuclide(sourceSpec) ? sourceSpec.a : 208;
  return 2.6 + 3.2 * Math.cbrt(a / 208) + (index % 3) * 0.35;
}

function sourceNucleusColor() {
  const z = isResolvedNuclide(sourceSpec) ? sourceSpec.z : 82;
  const t = Math.min(1, z / 92);
  const r = Math.round(154 - 38 * t);
  const g = Math.round(164 - 20 * t);
  const b = Math.round(168 + 22 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function readParams() {
  const query = new URLSearchParams(window.location.search);
  const sourceNuclide = query.get("source_nuclide") || DEFAULT_SOURCE_NUCLIDE;
  const productNuclide = query.get("product_nuclide") || DEFAULT_PRODUCT_NUCLIDE;
  const source = parseNuclide(sourceNuclide);
  const product = parseNuclide(productNuclide);
  return {
    sourceNuclide,
    productNuclide,
    sourceMassG: Number(query.get("source_mass_g") || 100),
    sourceFraction: Number(query.get("source_fraction") || 0.524),
    sourceMolarMassG: Number(
      query.has("source_molar_mass_g")
        ? query.get("source_molar_mass_g")
        : (isResolvedNuclide(source) ? source.molarMass : DEFAULT_SOURCE_MOLAR_MASS_G)
    ),
    productMolarMassG: Number(
      query.has("product_molar_mass_g")
        ? query.get("product_molar_mass_g")
        : (isResolvedNuclide(product) ? product.molarMass : DEFAULT_PRODUCT_MOLAR_MASS_G)
    ),
    collisions: Number(query.get("collisions") || 100000),
    probability: Number(query.get("probability") || 0.0001),
    seed: Number(query.get("seed") || 42),
  };
}

function fillElementOptions() {
  const options = listElements().map((element) => {
    const option = document.createElement("option");
    option.value = element.symbol;
    option.textContent = `${element.symbol}  (Z=${element.z})`;
    return option;
  });
  for (const name of ["source_element", "product_element"]) {
    const select = els.form.elements[name];
    select.replaceChildren(...options.map((option) => option.cloneNode(true)));
  }
}

function onElementChange(kind) {
  const symbol = els.form.elements[`${kind}_element`].value;
  const z = ELEMENTS[symbol][0];
  applyIsotopeBounds(kind, z, defaultMassNumber(symbol));
  syncMolarMass(kind);
}

function applyIsotopeBounds(kind, z, massNumber) {
  const bounds = isotopeBounds(z);
  const field = els.form.elements[`${kind}_a`];
  field.min = String(bounds.min);
  field.max = String(bounds.max);
  if (massNumber != null) field.value = String(massNumber);
}

function fillForm(values) {
  const fields = els.form.elements;
  const source = parseNuclide(values.sourceNuclide);
  const product = parseNuclide(values.productNuclide);
  if (isResolvedNuclide(source)) {
    fields.source_element.value = source.symbol;
    applyIsotopeBounds("source", source.z, source.a);
  }
  if (isResolvedNuclide(product)) {
    fields.product_element.value = product.symbol;
    applyIsotopeBounds("product", product.z, product.a);
  }
  fields.source_mass_g.value = values.sourceMassG;
  fields.source_fraction.value = values.sourceFraction;
  fields.source_molar_mass_g.value = values.sourceMolarMassG;
  fields.product_molar_mass_g.value = values.productMolarMassG;
  fields.collisions.value = values.collisions;
  fields.probability.value = values.probability;
  fields.seed.value = values.seed;
}

function formNuclide(kind) {
  const symbol = els.form.elements[`${kind}_element`].value;
  const massNumber = els.form.elements[`${kind}_a`].value;
  return composeNuclide(symbol, massNumber);
}

function readForm() {
  const fields = els.form.elements;
  return {
    sourceNuclide: formNuclide("source"),
    productNuclide: formNuclide("product"),
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
  const sourceError = nuclideError(values.sourceNuclide, "source");
  if (sourceError) return sourceError;
  const productError = nuclideError(values.productNuclide, "product");
  if (productError) return productError;
  if (!(values.sourceMassG > 0)) return t("err_mass");
  if (!(values.sourceFraction > 0 && values.sourceFraction <= 1)) return t("err_fraction");
  if (!(values.sourceMolarMassG > 0)) return t("err_source_molar");
  if (!(values.productMolarMassG > 0)) return t("err_product_molar");
  if (!(Number.isInteger(values.collisions) && values.collisions >= 1)) return t("err_collisions");
  if (!(values.probability >= 0 && values.probability <= 1)) return t("err_probability");
  if (!Number.isInteger(values.seed)) return t("err_seed");
  return "";
}

function nuclideError(text, kind) {
  if (!String(text || "").trim()) return t(`err_${kind}_empty`);
  const parsed = parseNuclide(text);
  if (parsed === false) return t(`err_${kind}_isotope`, { value: String(text).trim() });
  if (!parsed) return t(`err_${kind}_unknown`, { value: String(text).trim() });
  return "";
}

function syncMolarMass(kind) {
  const parsed = parseNuclide(formNuclide(kind));
  if (isResolvedNuclide(parsed)) {
    const molarField = kind === "source" ? "source_molar_mass_g" : "product_molar_mass_g";
    els.form.elements[molarField].value = parsed.molarMass;
  }
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
    views: viewsQueryValue(),
  });
}

function applyForm() {
  syncMolarMass("source");
  syncMolarMass("product");
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
    views: viewsQueryValue(),
  });
  window.location.search = query.toString();
}

function viewsQueryValue() {
  const parts = [];
  if (els.viewTarget.checked) parts.push("target");
  if (els.viewRing.checked) parts.push("ring");
  return parts.join(",") || "none";
}

function readViewsParam() {
  const raw = new URLSearchParams(window.location.search).get("views");
  if (raw == null) return { target: true, ring: true };
  if (raw === "none" || raw === "") return { target: false, ring: false };
  const parts = raw.split(",");
  return {
    target: parts.includes("target"),
    ring: parts.includes("ring"),
  };
}

function syncViews() {
  const showTarget = els.viewTarget.checked;
  const showRing = els.viewRing.checked;
  els.chamberTarget.hidden = !showTarget;
  els.chamberRing.hidden = !showRing;
  els.viewsEmpty.hidden = showTarget || showRing;
  els.chamberPanel.classList.toggle("is-single", Boolean(showTarget) !== Boolean(showRing));
  els.chamberPanel.classList.toggle("is-empty", !showTarget && !showRing);
  updateViewSummary();
  fitCanvas();
}

function updateViewSummary() {
  const target = els.viewTarget.checked;
  const ring = els.viewRing.checked;
  if (target && ring) els.viewMenuSummary.textContent = t("animations_both");
  else if (target) els.viewMenuSummary.textContent = t("view_target");
  else if (ring) els.viewMenuSummary.textContent = t("view_ring");
  else els.viewMenuSummary.textContent = t("animations_none");
}

function setViewMenuOpen(open) {
  els.viewMenu.hidden = !open;
  els.viewMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function onViewChange() {
  syncViews();
  const query = new URLSearchParams(window.location.search);
  query.set("views", viewsQueryValue());
  history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
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
