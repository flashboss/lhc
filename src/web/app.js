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
  speed: document.getElementById("speed"),
  lang: document.getElementById("lang"),
  pause: document.getElementById("pause"),
  restart: document.getElementById("restart"),
  form: document.getElementById("params-form"),
  error: document.getElementById("params-error"),
};

const gfx = createGraphics({
  t,
  getSourceNuclide: () => params.sourceNuclide,
  getSourceSpec: () => sourceSpec,
  isResolvedNuclide,
  getSpeedIndex: () => els.speed.selectedIndex,
  fmtCount,
});

const reaction = `${params.sourceNuclide} → ${params.productNuclide}`;
document.title = t("doc_title", { reaction });
document.getElementById("reaction-title").textContent = reaction;
els.lang.value = currentLang;

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

gfx.setExpected(fmt(expectedProduct));
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
  if (event.key === "Escape" && gfx.isViewMenuOpen()) {
    gfx.closeViewMenu();
    return;
  }
  if (event.code !== "Space") return;
  const tag = event.target && event.target.tagName;
  if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
  event.preventDefault();
  els.pause.click();
});
window.addEventListener("resize", () => {
  gfx.fitCanvas();
  gfx.clampOpWindow();
});
gfx.bind();
if (startupError) {
  gfx.setOp(t("phase_setup"), startupError, "", t("no_real_nuclei"));
} else {
  showSetupOp(setupOps[0], false);
}
requestAnimationFrame(frame);

function frame(ts) {
  const elapsed = (ts - state.lastTs) / 1000 || 0.016;
  state.lastTs = ts;
  if (state.paused || state.phase === "done") {
    gfx.holdOrbit();
  } else {
    gfx.updateOrbiters();
  }
  gfx.draw();
  if (!state.paused) step(Math.min(0.05, elapsed));
  requestAnimationFrame(frame);
}

function step(dt) {
  if (state.phase === "setup") {
    state.setupAcc += dt;
    if (state.setupAcc >= 1.15) {
      state.setupAcc = 0;
      gfx.logLine(setupOps[state.setupIndex].log, "setup");
      state.setupIndex += 1;
      if (state.setupIndex >= setupOps.length) {
        state.phase = "running";
        gfx.setOp(
          t("phase_collision"),
          t("first_draw_title"),
          t("first_draw_formula"),
          t("first_draw_result"),
        );
      } else {
        showSetupOp(setupOps[state.setupIndex], false);
      }
    }
    gfx.spawnBeam(dt, 18);
  } else if (state.phase === "running") {
    const perSecond = Number(els.speed.value);
    state.runAcc += perSecond * dt;
    const todo = Math.min(Math.floor(state.runAcc), 32);
    state.runAcc -= todo;
    if (todo > 0) runCollisions(todo);
    gfx.spawnBeam(dt, Math.min(90, 18 + Math.sqrt(perSecond)));
  }

  gfx.updateParticles(dt);
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
      gfx.convertNucleus();
      gfx.addFlash();
      gfx.logLine(
        t("collision_hit_log", {
          index: fmtCount(index),
          u: u.toFixed(8),
          product: params.productNuclide,
        }),
        "gold",
      );
      gfx.addGold(index, u);
    }
    last = { index, u, success };
    state.collision += 1;
    if (!success && Number(els.speed.value) <= 8) {
      gfx.logLine(
        t("collision_miss_log", { index: fmtCount(index), u: u.toFixed(8) }),
        "miss",
      );
    }
  }

  if (last) {
    const productMass = state.gold * params.productMolarMassG / AVOGADRO;
    gfx.setOp(
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
    gfx.setHud({
      collisions: fmtCount(last.index),
      gold: fmtCount(state.gold),
      mass: `${productMass.toExponential(4)} g`,
      progress: `${(state.collision / params.collisions) * 100}%`,
    });
    if (
      !last.success
      && Number(els.speed.value) > 8
      && last.index % Math.max(1, Math.floor(params.collisions / 20)) === 0
    ) {
      gfx.logLine(t("collision_miss_short", { index: fmtCount(last.index) }), "miss");
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
  gfx.setOp(
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
  gfx.logLine(t("events_simulated_log", { value: fmtCount(state.gold) }), "gold");
  gfx.logLine(
    t("equivalent_mass_log", {
      product: params.productNuclide,
      mass: productMass.toExponential(6),
    }),
    "setup",
  );
  gfx.logLine(t("didactic_warning_log"), "miss");
}

function showSetupOp(op, writeLog) {
  gfx.setOp(op.phase, op.title, op.formula, op.result);
  if (writeLog) gfx.logLine(op.log, "setup");
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
    views: gfx.viewsQueryValue(),
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
    views: gfx.viewsQueryValue(),
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
