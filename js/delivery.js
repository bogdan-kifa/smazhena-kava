/* Delivery information and local cart preview; no carrier or payment requests. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!$("mo-delivery-tabs")) return;
  const tabs = [...$("mo-delivery-tabs").children];
  const panels = tabs.map((_, i) => $(`mo-delivery-panel-${i}`));
  $("mo-delivery-tabs").hidden = false;
  $("mo-delivery-tabs").setAttribute("role", "tablist");
  $("mo-delivery-tabs").setAttribute("aria-label", "Спосіб доставки");
  function select(index, focus = false) {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, i) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[i].id);
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", tab.id);
    panels[i].removeAttribute("aria-label");
    panels[i].tabIndex = 0;
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (event) => {
      let target = i;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") target = (i + 1) % tabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        target = (i + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = tabs.length - 1;
      else return;
      event.preventDefault();
      select(target, true);
    });
  });
  select(0);
  const contact = window.CoffeeFooterConfig;
  if (contact?.socials?.telegram) $("mo-delivery-telegram").href = contact.socials.telegram;
  if (contact?.phoneHref) $("mo-delivery-phone").href = contact.phoneHref;
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  document.querySelectorAll(".mo-delivery-faq details").forEach((details) => {
    const summary = details.querySelector("summary");
    summary.setAttribute("aria-expanded", String(details.open));
    details.addEventListener("toggle", () => {
      summary.setAttribute("aria-expanded", String(details.open));
      if (details.open && motion.matches)
        details.querySelector(".mo-delivery-answer").animate(
          [
            { opacity: 0, transform: "translateY(-4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 180 },
        );
    });
  });
  // Heights remain native to details; only the answer's opacity and transform animate.
  if ("IntersectionObserver" in window) {
    const timeline = document.querySelector(".mo-delivery-timeline");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          timeline.classList.add("mo-delivery-seen");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(timeline);
  }
  const S = window.CoffeeShop;
  if (!S) return;
  const threshold = 80000;
  let suggestion = null,
    pending = false;
  function render() {
    const state = S.get(),
      total = S.total(),
      remaining = Math.max(0, threshold - total);
    const money = (value) => S.money(value).replace(/\s+₴/u, "\u00a0₴");
    $("mo-delivery-progress-copy").textContent =
      total === 0
        ? "Додайте каву в кошик — покажемо, скільки залишилось до безкоштовної доставки."
        : remaining
          ? `У кошику ${money(total)} — ще ${money(remaining)} до безкоштовної доставки.`
          : `У кошику ${money(total)} — доставка за наш рахунок!`;
    $("mo-delivery-progress").setAttribute(
      "aria-valuenow",
      String(Math.min(total, threshold) / 100),
    );
    $("mo-delivery-progress").setAttribute(
      "aria-valuetext",
      remaining ? `Залишилось ${money(remaining)}` : "Безкоштовна доставка",
    );
    $("mo-delivery-progress-fill").style.transform = `scaleX(${Math.min(1, total / threshold)})`;
    document.body.classList.toggle("mo-delivery-has-cart", state.cart.length > 0);
    $("mo-delivery-mobile").hidden = state.cart.length === 0;
    $("mo-delivery-mobile-amount").textContent = remaining
      ? money(remaining)
      : "Доставка безкоштовна";
    $("mo-delivery-mobile").firstElementChild.firstElementChild.textContent = remaining
      ? "До безкоштовної доставки"
      : `У кошику ${money(total)}`;
    // A quick addition is offered only for an actual favourite, with its format stated.
    suggestion = S.products.find(
      (product) => state.favorites.includes(product.id) && !S.isGreen(product),
    );
    $("mo-delivery-suggestion").hidden = !suggestion || remaining === 0;
    if (suggestion) {
      $("mo-delivery-suggestion-name").textContent = `${suggestion.name} · 250 г · у зернах`;
      $("mo-delivery-add").textContent = `Додати за ${money(S.productPrice(suggestion, 250))}`;
    }
  }
  $("mo-delivery-add").addEventListener("click", async () => {
    if (!suggestion || pending) return;
    pending = true;
    $("mo-delivery-add").disabled = true;
    try {
      await S.addProduct(suggestion.id, 250, "beans");
    } finally {
      pending = false;
      $("mo-delivery-add").disabled = false;
      render();
    }
  });
  render();
  window.addEventListener("coffee:change", render);
  // A single decorative number reveal; the real threshold is readable without JS/motion.
  if ("IntersectionObserver" in window && motion.matches) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      function count(now) {
        const progress = Math.min(1, (now - start) / 500);
        $("mo-delivery-threshold").textContent = Math.round(800 * progress);
        if (progress < 1 && motion.matches) requestAnimationFrame(count);
        else $("mo-delivery-threshold").textContent = "800";
      }
      requestAnimationFrame(count);
    });
    observer.observe($("mo-delivery-threshold"));
  }
})();
