/* Shared catalogue data drives every product page; no purchase state is changed. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    profile = document.querySelector(".mo-product-profile");
  if (!S || !profile) return;
  const product = S.byId.get(profile.dataset.product);
  if (!product) return;
  const green = S.isGreen(product),
    roastSelect = document.getElementById("product-roast");
  const names = { light: "світлого", medium: "середнього", dark: "темного" };
  const format = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 });
  function update() {
    // Unroasted beans have no brewed taste score: show the same labelled medium-roast preview as the catalogue.
    const selected = roastSelect?.value,
      roast = Object.hasOwn(names, selected) ? selected : "medium";
    const taste = green ? product.tasteByRoast?.[roast] : product.taste;
    const strength = green ? product.strengthByRoast?.[roast] : product.strength;
    const values = { ...taste, strength: Number.isFinite(strength) ? strength * 20 : null };
    for (const row of profile.querySelectorAll("[data-mo-metric]")) {
      const raw = values[row.dataset.moMetric],
        available = Number.isFinite(raw) && raw >= 0 && raw <= 100;
      const score = available ? raw / 10 : null;
      row.querySelector(".mo-product-profile-value").textContent = available
        ? format.format(score)
        : "—";
      const meter = row.querySelector("meter"),
        missing = row.querySelector(".mo-product-profile-missing");
      meter.hidden = !available;
      missing.hidden = available;
      if (available) {
        meter.value = score;
        meter.textContent = `${format.format(score)} з 10`;
      }
      row.querySelectorAll(".mo-product-profile-pips > span").forEach((pip, index) => {
        pip.style.setProperty(
          "--mo-pip-fill",
          `${available ? Math.max(0, Math.min(100, (score - index * 2) * 50)) : 0}%`,
        );
      });
    }
    const basis = profile.querySelector(".mo-product-profile-basis");
    if (green) {
      basis.hidden = false;
      const text = `Після ${names[roast]} обсмаження${!selected || selected === "raw" ? " · орієнтир для зеленого зерна" : ""}`;
      if (basis.textContent !== text) basis.textContent = text;
    } else basis.hidden = true;
  }
  roastSelect?.addEventListener("change", update);
  update();
})();
