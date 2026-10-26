/* Нативне гортання карток кави кнопками, свайпом і клавіатурою. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S,
    list = document.querySelector('[data-component="coffee-grid"]');
  if (!list) return;
  const originals = [...list.children],
    shown = new Set(
      originals.map((li) =>
        li
          .querySelector('a[href*="products/"]')
          .getAttribute("href")
          .split("/")
          .pop()
          .replace(".html", ""),
      ),
    );
  for (const p of S.products.filter((p) => !shown.has(p.id)).slice(0, 3)) {
    const li = originals[0].cloneNode(true),
      card = li.querySelector("article"),
      heading = li.querySelector("h3"),
      id = `home-${p.id}`;
    heading.id = id;
    card.setAttribute("aria-labelledby", id);
    heading.querySelector("a").textContent = p.name;
    li.querySelectorAll('a[href*="products/"]').forEach((a) => {
      a.href =
        S.url(`products/${p.id}.html`) +
        (a.getAttribute("href").includes("#") ? "#product-purchase" : "");
      if (a.hasAttribute("aria-label")) a.setAttribute("aria-label", `${p.name} — детальніше`);
    });
    const img = li.querySelector("img");
    img.src = S.url(p.image);
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.alt = `Кавові зерна: ${p.name}`;
    img.loading = "lazy";
    const meta = heading.previousElementSibling;
    if (meta) {
      meta.dataset.cardMetadata = p.id;
      meta.querySelector("span").textContent = p.originLabel;
      meta.querySelector("span:last-child").textContent = {
        light: "Світле обсмаження",
        medium: "Середнє обсмаження",
        dark: "Темне обсмаження",
      }[p.roast];
    }
    const description = li.querySelector("p.text-sm");
    if (description) description.textContent = p.notes;
    const price = li.querySelector("[data-card-price]");
    if (price) price.textContent = `від ${S.money(p.price)}`;
    const b = li.querySelector("button");
    b.disabled = false;
    b.dataset.addBean = p.id;
    b.removeAttribute("aria-describedby");
    list.append(li);
  }
  list.classList.add("shop-carousel");
  list.id = "home-coffee-carousel";
  list.tabIndex = 0;
  list.setAttribute("aria-label", "Добірка кави з горизонтальним гортанням");
  const label = n("span", { class: "muted", "aria-live": "polite" }),
    prev = n("button", {
      type: "button",
      class: "button button-secondary",
      "aria-label": "Попередні сорти кави",
      "aria-controls": list.id,
      text: "←",
    }),
    next = n("button", {
      type: "button",
      class: "button button-secondary",
      "aria-label": "Наступні сорти кави",
      "aria-controls": list.id,
      text: "→",
    });
  const controls = n(
    "div",
    { class: "shop-carousel-controls" },
    label,
    n("div", { class: "actions" }, prev, next),
  );
  list.after(controls);
  const motion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  const step = () =>
    list.children[0].getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap);
  prev.addEventListener("click", () => list.scrollBy({ left: -step(), behavior: motion() }));
  next.addEventListener("click", () => list.scrollBy({ left: step(), behavior: motion() }));
  list.addEventListener("keydown", (event) => {
    if (event.target !== list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    if (event.key === "Home") list.scrollTo({ left: 0, behavior: motion() });
    else if (event.key === "End") list.scrollTo({ left: list.scrollWidth, behavior: motion() });
    else list.scrollBy({ left: step() * (event.key === "ArrowLeft" ? -1 : 1), behavior: motion() });
  });
  function sync() {
    const index = Math.round(list.scrollLeft / step()),
      visible = Math.max(1, Math.round(list.clientWidth / step()));
    label.textContent = `${index + 1}–${Math.min(list.children.length, index + visible)} із ${list.children.length}`;
    prev.disabled = list.scrollLeft < 2;
    next.disabled = list.scrollLeft >= list.scrollWidth - list.clientWidth - 2;
  }
  let timer;
  list.addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 120);
  });
  new ResizeObserver(sync).observe(list);
  sync();
})();
