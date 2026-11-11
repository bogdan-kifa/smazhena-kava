(() => {
  const key = "smazhena-kava-theme";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference;
  try {
    preference = localStorage.getItem(key);
  } catch {}

  function apply() {
    const dark = preference === "dark" || (preference !== "light" && system.matches);
    root.dataset.theme = dark ? "dark" : "light";
    const button = document.querySelector("[data-theme-toggle]");
    if (button) button.setAttribute("aria-pressed", String(dark));
  }

  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue;
    apply();
  });
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    apply();
    button.hidden = false;
    button.addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, preference);
      } catch {}
      apply();
    });
  });
})();
