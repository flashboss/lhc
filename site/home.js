currentLang = detectLang();
applyI18n();
document.title = t("home_doc_title");

const lang = document.getElementById("lang");
const openSim = document.getElementById("open-sim");
lang.value = currentLang;
openSim.textContent = t("home_open");
document.querySelector(".btn.ghost").textContent = t("home_github");
openSim.href = `src/web/index.html?lang=${encodeURIComponent(currentLang)}`;

const applyLang = () => {
  if (lang.value === currentLang) return;
  const query = new URLSearchParams(window.location.search);
  query.set("lang", lang.value);
  window.location.search = query.toString();
};
lang.addEventListener("change", applyLang);
lang.addEventListener("input", applyLang);
