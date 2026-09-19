const RING_OMEGA = [0.6, 1.4, 2.8, 5.5, 9.5];

function createGraphics(options) {
  const els = {
    canvas: document.getElementById("chamber"),
    ring: document.getElementById("ring"),
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
    opChrome: document.getElementById("op-chrome"),
    opToggle: document.getElementById("op-toggle"),
    log: document.getElementById("log"),
    golds: document.getElementById("golds"),
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

  const ctx = els.canvas.getContext("2d");
  const ringCtx = els.ring.getContext("2d");
  const visual = {
    orbitNow: null,
    particles: [],
    flashes: [],
    nuclei: makeNuclei(42),
    orbiters: makeOrbiters(24),
  };

  function t(key, values) {
    return options.t(key, values);
  }

  function nucleusRadius(index) {
    const spec = options.getSourceSpec();
    const a = options.isResolvedNuclide(spec) ? spec.a : 208;
    return 2.6 + 3.2 * Math.cbrt(a / 208) + (index % 3) * 0.35;
  }

  function sourceNucleusColor() {
    const spec = options.getSourceSpec();
    const z = options.isResolvedNuclide(spec) ? spec.z : 82;
    const tone = Math.min(1, z / 92);
    const r = Math.round(154 - 38 * tone);
    const g = Math.round(164 - 20 * tone);
    const b = Math.round(168 + 22 * tone);
    return `rgb(${r}, ${g}, ${b})`;
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

  function setOp(phase, title, formula, result, tone, labelKey) {
    els.opLabel.textContent = t(labelKey || "current_op");
    els.currentOp.classList.toggle("is-done", labelKey === "finished_op");
    els.phase.textContent = phase;
    els.title.textContent = title;
    els.formula.textContent = formula;
    els.result.textContent = result;
    els.result.style.color = tone === "gold" ? "#e2b340" : "#7ddeb0";
  }

  function placeOpWindow(left, top) {
    const panel = els.chamberPanel.getBoundingClientRect();
    const win = els.currentOp.getBoundingClientRect();
    const maxLeft = Math.max(0, panel.width - win.width);
    const maxTop = Math.max(0, panel.height - win.height);
    const x = Math.min(maxLeft, Math.max(0, left));
    const y = Math.min(maxTop, Math.max(0, top));
    els.currentOp.style.left = `${x}px`;
    els.currentOp.style.top = `${y}px`;
    els.currentOp.style.right = "auto";
    els.currentOp.style.bottom = "auto";
  }

  function clampOpWindow() {
    if (!els.currentOp.style.left && !els.currentOp.style.top) return;
    const panel = els.chamberPanel.getBoundingClientRect();
    const win = els.currentOp.getBoundingClientRect();
    placeOpWindow(win.left - panel.left, win.top - panel.top);
  }

  function setupOpWindow() {
    let drag = null;
    const startDrag = (event) => {
      if (event.button != null && event.button !== 0) return;
      if (event.target.closest("button")) return;
      const win = els.currentOp.getBoundingClientRect();
      drag = { dx: event.clientX - win.left, dy: event.clientY - win.top };
      els.currentOp.classList.add("is-dragging");
    };
    const moveDrag = (event) => {
      if (!drag) return;
      const panel = els.chamberPanel.getBoundingClientRect();
      placeOpWindow(event.clientX - panel.left - drag.dx, event.clientY - panel.top - drag.dy);
    };
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      els.currentOp.classList.remove("is-dragging");
    };

    els.opChrome.addEventListener("pointerdown", (event) => {
      startDrag(event);
      if (drag && event.pointerId != null) els.opChrome.setPointerCapture(event.pointerId);
    });
    els.opChrome.addEventListener("pointermove", moveDrag);
    els.opChrome.addEventListener("pointerup", endDrag);
    els.opChrome.addEventListener("pointercancel", endDrag);
    els.opChrome.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", moveDrag);
    window.addEventListener("mouseup", endDrag);
    els.opToggle.addEventListener("click", () => {
      const minimized = els.currentOp.classList.toggle("is-min");
      els.opToggle.textContent = minimized ? "+" : "–";
      els.opToggle.setAttribute("aria-expanded", minimized ? "false" : "true");
      els.opToggle.setAttribute("aria-label", t(minimized ? "op_restore" : "op_minimize"));
      clampOpWindow();
    });
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
    li.textContent = `#${options.fmtCount(index)}  u=${u.toFixed(8)}`;
    els.golds.prepend(li);
  }

  function convertNucleus() {
    const source = visual.nuclei.find((nucleus) => !nucleus.gold);
    if (source) source.gold = true;
  }

  function addFlash() {
    visual.flashes.push({ t: 0, gold: true });
  }

  function holdOrbit() {
    visual.orbitNow = performance.now();
  }

  function updateOrbiters() {
    const now = performance.now();
    if (visual.orbitNow == null) visual.orbitNow = now;
    const dt = Math.min(0.08, (now - visual.orbitNow) / 1000);
    visual.orbitNow = now;
    const omega = RING_OMEGA[options.getSpeedIndex()] ?? 1.6;
    for (const orbiter of visual.orbiters) {
      orbiter.angle += orbiter.dir * omega * dt;
    }
  }

  function spawnBeam(dt, rate) {
    const n = Math.max(0, Math.round(rate * dt));
    for (let i = 0; i < n; i += 1) {
      visual.particles.push({
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
    for (const particle of visual.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.x > -12 && particle.x < 18) {
        particle.vy += (Math.random() - 0.5) * 40 * dt;
        particle.life -= dt * 0.35;
      }
      if (particle.x > 40) particle.life -= dt * 1.8;
    }
    visual.particles = visual.particles.filter((particle) => particle.life > 0 && particle.x < 230);
    for (const flash of visual.flashes) flash.t += dt;
    visual.flashes = visual.flashes.filter((flash) => flash.t < 0.6);
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

    for (const flash of visual.flashes) {
      ctx.beginPath();
      ctx.arc(0, 0, 20 + flash.t * 180, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(226, 179, 64, ${1 - flash.t / 0.6})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    for (const nucleus of visual.nuclei) {
      ctx.beginPath();
      ctx.arc(nucleus.x, nucleus.y, nucleus.r, 0, Math.PI * 2);
      ctx.fillStyle = nucleus.gold ? "#e2b340" : sourceNucleusColor();
      ctx.fill();
    }

    for (const particle of visual.particles) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(110, 196, 255, ${particle.life})`;
      ctx.fill();
    }

    ctx.fillStyle = "#e7edf6";
    ctx.font = "12px Menlo, monospace";
    ctx.fillText(t("virtual_beam"), -248, -18);
    ctx.fillText(t("target_label", { source: options.getSourceNuclide() }), 48, -18);
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

    for (const flash of visual.flashes) {
      ringCtx.beginPath();
      ringCtx.arc(-200, 0, 8 + flash.t * 90, 0, Math.PI * 2);
      ringCtx.strokeStyle = `rgba(226, 179, 64, ${1 - flash.t / 0.6})`;
      ringCtx.lineWidth = 3;
      ringCtx.stroke();
    }

    for (const orbiter of visual.orbiters) {
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

  function onViewChange() {
    syncViews();
    const query = new URLSearchParams(window.location.search);
    query.set("views", viewsQueryValue());
    history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
  }

  function bind() {
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
    setupOpWindow();
    els.canvas.setAttribute("aria-label", t("chamber_aria"));
    els.ring.setAttribute("aria-label", t("ring_aria"));
    syncViews();
  }

  function setExpected(text) {
    els.expected.textContent = text;
  }

  function setHud({ collisions, gold, mass, progress }) {
    if (collisions != null) els.collisions.textContent = collisions;
    if (gold != null) els.gold.textContent = gold;
    if (mass != null) els.mass.textContent = mass;
    if (progress != null) els.progress.style.width = progress;
  }

  return {
    bind,
    draw,
    fitCanvas,
    clampOpWindow,
    holdOrbit,
    updateOrbiters,
    spawnBeam,
    updateParticles,
    convertNucleus,
    addFlash,
    setOp,
    logLine,
    addGold,
    setExpected,
    setHud,
    viewsQueryValue,
    isViewMenuOpen: () => !els.viewMenu.hidden,
    closeViewMenu: () => {
      setViewMenuOpen(false);
      els.viewMenuBtn.focus();
    },
  };
}
