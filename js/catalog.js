(() => {
  "use strict";
  const S = window.CoffeeShop,
    form = document.querySelector(".catalog-controls");
  if (!form) return;
  const { node: n } = S,
    grid = document.querySelector(".catalog-grid"),
    pagination = document.querySelector(".catalog-pagination"),
    count = document.querySelector(".catalog-count");
  const params = new URLSearchParams(location.search);
  const options = {
    q: params.get("q") || "",
    origin: params.get("origin") || "",
    roast: params.get("roast") || "",
    profile: params.get("profile") || "",
    price: params.get("price") || "",
    sort: params.get("sort") || "",
    favorites: params.get("favorites") === "1",
    category: params.get("category") === "green" ? "green" : "roasted",
    page: Number(params.get("page")) || (location.pathname.includes("catalog-page-2") ? 2 : 1),
  };
  form.querySelectorAll("fieldset").forEach((x) => (x.disabled = false));
  const search = n(
    "div",
    { class: "shop-search" },
    n("label", { for: "catalog-search", text: "Знайти каву" }),
    n("input", {
      id: "catalog-search",
      type: "search",
      name: "q",
      maxlength: 100,
      placeholder: "Назва, країна або смакові ноти",
      value: options.q,
    }),
  );
  const favorite = n("input", {
    id: "catalog-favorites",
    type: "checkbox",
    checked: options.favorites,
  });
  const extra = n(
    "div",
    { class: "shop-catalog-tools" },
    n("label", { class: "shop-check" }, favorite, "Лише обране"),
    n("button", {
      type: "button",
      class: "button button-secondary",
      "data-reset-catalog": "",
      text: "Скинути фільтри",
    }),
  );
  form.prepend(search);
  form.append(extra);
  document.getElementById("catalog-controls-description").textContent =
    "Пошук та фільтри охоплюють усі 12 сортів. До дев’яти товарів на сторінці. Зеленого зерна в поточному асортименті немає.";
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");
  count.tabIndex = -1;
  let favoriteSnapshot = JSON.stringify(S.get().favorites);
  for (const key of ["origin", "roast", "profile", "price", "sort"]) {
    const select = form.elements[key];
    select.value = options[key];
    if (!select.value) options[key] = "";
    select.addEventListener("change", () => {
      options[key] = select.value;
      options.page = 1;
      render();
    });
  }
  form.elements.q.addEventListener("input", () => {
    options.q = form.elements.q.value.trim();
    options.page = 1;
    render();
  });
  favorite.addEventListener("change", () => {
    options.favorites = favorite.checked;
    options.page = 1;
    render();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    options.page = 1;
    render();
  });
  form.querySelectorAll(".catalog-category").forEach((b, i) =>
    b.addEventListener("click", () => {
      options.category = i ? "green" : "roasted";
      options.page = 1;
      render();
    }),
  );
  form.querySelector("[data-reset-catalog]").addEventListener("click", () => {
    Object.assign(options, {
      q: "",
      origin: "",
      roast: "",
      profile: "",
      price: "",
      sort: "",
      favorites: false,
      category: "roasted",
      page: 1,
    });
    form.reset();
    form.elements.q.value = "";
    favorite.checked = false;
    for (const key of ["origin", "roast", "profile", "price", "sort"])
      form.elements[key].value = "";
    render();
  });
  function card(p) {
    const favorite = n(
      "button",
      {
        class: "product-favorite",
        type: "button",
        "data-favorite": p.id,
        "aria-pressed": "false",
        "aria-label": `Додати каву «${p.name}» до обраного`,
      },
      n("i", { class: "fa-regular fa-heart icon", "aria-hidden": "true" }),
    );
    const spec = (key, value) => n("div", {}, n("dt", { text: key }), n("dd", { text: value }));
    return n(
      "li",
      {},
      n(
        "article",
        { class: "card product-card catalog-product", "aria-labelledby": `catalog-${p.id}` },
        n(
          "div",
          { class: "product-media" },
          n("span", { class: "product-badge", text: "Single origin" }),
          n(
            "a",
            {
              class: "product-media-link",
              href: S.url(`products/${p.id}.html`),
              "aria-label": `${p.name} — детальніше`,
            },
            n("img", {
              src: S.url(p.image),
              alt: `Кавові зерна: ${p.name}`,
              width: 1536,
              height: 1024,
              loading: "lazy",
              decoding: "async",
            }),
          ),
        ),
        n(
          "div",
          { class: "catalog-product-heading" },
          n(
            "div",
            { class: "catalog-product-heading-copy" },
            n("p", { class: "eyebrow", text: p.originLabel }),
            n(
              "h3",
              { id: `catalog-${p.id}` },
              n("a", {
                class: "product-title-link",
                href: S.url(`products/${p.id}.html`),
                text: p.name,
              }),
            ),
          ),
          favorite,
        ),
        n("p", { class: "catalog-product-notes", text: p.notes }),
        n(
          "dl",
          { class: "catalog-product-specs" },
          spec("Обробка", p.processing),
          spec("Обсмаження", { light: "Світле", medium: "Середнє", dark: "Темне" }[p.roast]),
          spec("Кислотність", p.acidity),
        ),
        n(
          "div",
          { class: "catalog-product-price" },
          n("p", { class: "price", text: S.money(p.price) }),
          n("span", { class: "muted", text: "250 г · в наявності" }),
        ),
        n(
          "div",
          { class: "catalog-product-actions" },
          n("button", {
            class: "button button-secondary",
            type: "button",
            "data-buy-product": p.id,
            text: "Купити",
          }),
          n("button", {
            class: "button",
            type: "button",
            "data-add-bean": p.id,
            text: "Додати до міксу",
          }),
        ),
      ),
    );
  }
  function render() {
    const active = document.activeElement,
      focus = active?.closest("[data-favorite],[data-add-bean],[data-buy-product]"),
      focusAttribute =
        focus &&
        ["data-favorite", "data-add-bean", "data-buy-product"].find((key) =>
          focus.hasAttribute(key),
        ),
      focusId = focusAttribute && focus.getAttribute(focusAttribute),
      focusPosition = focus ? [...grid.querySelectorAll(`[${focusAttribute}]`)].indexOf(focus) : -1,
      state = S.get();
    favoriteSnapshot = JSON.stringify(state.favorites);
    let list =
      options.category === "green"
        ? []
        : S.products.filter((p) => {
            const query = options.q.toLocaleLowerCase("uk");
            return (
              (!query ||
                `${p.name} ${p.originLabel} ${p.notes}`.toLocaleLowerCase("uk").includes(query)) &&
              (!options.origin || p.origin === options.origin) &&
              (!options.roast || p.roast === options.roast) &&
              (!options.profile || p.profiles.includes(options.profile)) &&
              (!options.favorites || state.favorites.includes(p.id)) &&
              (!options.price ||
                (options.price === "under-350"
                  ? p.price < 35000
                  : options.price === "350-400"
                    ? p.price >= 35000 && p.price <= 40000
                    : p.price > 40000))
            );
          });
    if (options.sort === "price-ascending") list.sort((a, b) => a.price - b.price);
    if (options.sort === "price-descending") list.sort((a, b) => b.price - a.price);
    if (options.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    const pages = Math.max(1, Math.ceil(list.length / 9));
    options.page = Math.min(pages, Math.max(1, Math.trunc(options.page) || 1));
    const begin = (options.page - 1) * 9;
    count.textContent = list.length
      ? `Товари ${begin + 1}–${Math.min(begin + 9, list.length)} із ${list.length}`
      : "Нічого не знайдено. Змініть запит або скиньте фільтри.";
    grid.replaceChildren(...list.slice(begin, begin + 9).map(card));
    grid.setAttribute("aria-label", "Результати пошуку кави");
    pagination.replaceChildren();
    if (pages > 1) {
      const ul = n("ul", { role: "list" });
      for (let i = 1; i <= pages; i++) {
        const b = n("button", {
          type: "button",
          class: `catalog-page-link${i === options.page ? " catalog-page-current" : ""}`,
          "aria-label": `Сторінка ${i}`,
          "aria-current": i === options.page ? "page" : null,
          text: i,
        });
        b.addEventListener("click", () => {
          options.page = i;
          render();
          count.scrollIntoView({ block: "start", behavior: "instant" });
          count.focus({ preventScroll: true });
        });
        ul.append(n("li", {}, b));
      }
      pagination.append(ul);
    }
    form.querySelectorAll(".catalog-category").forEach((b, i) => {
      const selected = (options.category === "green") === Boolean(i);
      b.classList.toggle("catalog-category-current", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    const url = new URL(location.href);
    url.search = "";
    for (const [key, value] of Object.entries(options)) {
      // Старий HTML другої сторінки потребує явного page=1 після перемикання.
      if (
        value &&
        !(key === "page" && value === 1 && !location.pathname.includes("catalog-page-2")) &&
        !(key === "category" && value === "roasted")
      )
        url.searchParams.set(key, value === true ? "1" : value);
    }
    history.replaceState(null, "", url);
    window.dispatchEvent(new CustomEvent("coffee:cards-rendered"));
    for (const b of grid.querySelectorAll("[data-favorite]")) {
      const active = state.favorites.includes(b.dataset.favorite);
      b.classList.toggle("is-favorite", active);
      b.setAttribute("aria-pressed", String(active));
      b.setAttribute(
        "aria-label",
        `${active ? "Прибрати" : "Додати"} каву «${S.byId.get(b.dataset.favorite).name}» ${active ? "з обраного" : "до обраного"}`,
      );
      b.querySelector("i").classList.remove("fa-solid");
      b.querySelector("i").classList.add("fa-regular");
    }
    if (focusId) {
      const same = [...grid.querySelectorAll(`[${focusAttribute}]`)].find(
          (button) => button.getAttribute(focusAttribute) === focusId,
        ),
        remaining = [...grid.querySelectorAll(`[${focusAttribute}]`)];
      // Після вилучення з обраного переходимо до сусідньої картки або повідомлення.
      (same || remaining[Math.min(focusPosition, remaining.length - 1)] || count).focus({
        preventScroll: true,
      });
    }
  }
  window.addEventListener("coffee:change", (event) => {
    const changed = event.detail?.changed;
    if (
      changed
        ? changed.includes("favorites")
        : JSON.stringify(S.get().favorites) !== favoriteSnapshot
    )
      render();
  });
  render();
})();
