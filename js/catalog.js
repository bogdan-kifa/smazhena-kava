/* Catalogue presentation over CoffeeShop products, filters, favourites and draft. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    n = S.node,
    form = document.querySelector(".catalog-controls");
  if (!form) return;
  const grid = document.querySelector(".catalog-grid"),
    count = document.getElementById("catalog-result-count"),
    empty = document.getElementById("catalog-empty"),
    activeFilters = document.getElementById("catalog-active-filters"),
    reset = document.getElementById("catalog-reset"),
    greenHelp = document.getElementById("catalog-green-help"),
    filterBody = document.getElementById("catalog-filter-body"),
    filterHome = document.getElementById("catalog-filter-home"),
    advanced = document.getElementById("catalog-advanced-fields"),
    more = document.getElementById("catalog-more"),
    favoriteFilter = document.getElementById("catalog-favorites"),
    dialog = document.getElementById("catalog-filter-sheet"),
    sheetContent = document.getElementById("catalog-sheet-content"),
    sheetApply = document.getElementById("catalog-sheet-apply"),
    stickyToggle = document.getElementById("catalog-sticky-filters");
  const names = {
    roast: S.roasts,
    taste: {
      floral: "Квітковий",
      fruity: "Фруктовий",
      chocolate: "Шоколадний",
      nutty: "Горіховий",
    },
    processing: Object.fromEntries(
      [
        ...new Set([
          "Washed",
          "Natural",
          "Honey",
          ...S.products.filter(S.isGreen).map((p) => p.processing),
        ]),
      ].map((v) => [v, v]),
    ),
    price: { "under-350": "Менше 350 ₴", "350-400": "350–400 ₴", "over-400": "Понад 400 ₴" },
    method: { espresso: "Еспресо", filter: "Фільтр", cezve: "Джезва" },
    sort: {
      "price-ascending": "Спочатку дешевші",
      "price-descending": "Спочатку дорожчі",
      name: "За назвою",
    },
  };
  const countries = new Map(S.products.map((p) => [p.origin, p.originLabel.split(",")[0].trim()]));
  function readOptions() {
    const params = new URLSearchParams(location.search),
      valid = (key) => (Object.hasOwn(names[key], params.get(key)) ? params.get(key) : "");
    return {
      q: (params.get("q") || "").trim().slice(0, 100),
      category: params.get("category") === "green" ? "green" : "roasted",
      roast: valid("roast"),
      processing: valid("processing"),
      taste: [
        ...new Set(
          params
            .getAll("taste")
            .concat(params.getAll("profile"))
            .flatMap((v) => v.split(","))
            .filter((v) => Object.hasOwn(names.taste, v)),
        ),
      ],
      origin: countries.has(params.get("origin")) ? params.get("origin") : "",
      price: valid("price"),
      method: valid("method"),
      stock: params.get("stock") === "1",
      favorites: params.get("favorites") === "1",
      sort: valid("sort"),
    };
  }
  let options = readOptions(),
    searchTimer = 0,
    expanded = false;
  const mixWrites = new Set(),
    mobile = matchMedia("(max-width: 767px)");
  const availability = (p) => p.availability || "available";
  function matches(p, filters = options, skipGroup = "") {
    const query = filters.q.toLocaleLowerCase("uk");
    return (
      S.isGreen(p) === (filters.category === "green") &&
      (skipGroup === "q" ||
        !query ||
        `${p.name} ${p.originLabel} ${p.notes}`.toLocaleLowerCase("uk").includes(query)) &&
      (skipGroup === "roast" || !filters.roast || p.roast === filters.roast) &&
      (skipGroup === "processing" || !filters.processing || p.processing === filters.processing) &&
      (skipGroup === "taste" ||
        !filters.taste.length ||
        filters.taste.some((t) => p.profiles.includes(t))) &&
      (skipGroup === "origin" || !filters.origin || p.origin === filters.origin) &&
      (skipGroup === "method" || !filters.method || S.brewingMethods(p).includes(filters.method)) &&
      (skipGroup === "stock" || !filters.stock || availability(p) !== "unavailable") &&
      (skipGroup === "favorites" || !filters.favorites || S.get().favorites.includes(p.id)) &&
      (skipGroup === "price" ||
        !filters.price ||
        (filters.price === "under-350"
          ? p.price < 35000
          : filters.price === "350-400"
            ? p.price >= 35000 && p.price <= 40000
            : p.price > 40000))
    );
  }
  function writeURL(mode = "push") {
    clearTimeout(searchTimer);
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/catalog-page-2\.html$/, "catalog.html");
    url.search = "";
    for (const [key, value] of Object.entries(options)) {
      if (
        !value ||
        (Array.isArray(value) && !value.length) ||
        (key === "category" && value === "roasted")
      )
        continue;
      url.searchParams.set(
        key,
        Array.isArray(value) ? value.join(",") : value === true ? "1" : value,
      );
    }
    if (url.href !== location.href)
      history[mode === "replace" ? "replaceState" : "pushState"](null, "", url);
  }
  function change() {
    render();
    writeURL();
  }
  function syncFields() {
    form.elements.q.value = options.q;
    for (const key of ["origin", "price", "method", "sort"])
      form.elements[key].value = options[key];
    form.elements.stock.checked = options.stock;
  }
  for (const key of ["origin", "price", "method", "sort"])
    form.elements[key].addEventListener("change", () => {
      options[key] = form.elements[key].value;
      change();
    });
  form.elements.stock.addEventListener("change", () => {
    options.stock = form.elements.stock.checked;
    change();
  });
  form.elements.q.addEventListener("input", () => {
    options.q = form.elements.q.value.trim().slice(0, 100);
    render();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => writeURL(), 350);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    writeURL();
  });
  const categoryButtons = [...form.querySelectorAll("[data-category]")];
  function setCategory(value) {
    options.category = value;
    options.roast = "";
    options.processing = "";
    options.method = "";
    change();
  }
  categoryButtons.forEach((button, index) => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
    button.addEventListener("keydown", (e) => {
      const direction = ["ArrowRight", "ArrowDown"].includes(e.key)
        ? 1
        : ["ArrowLeft", "ArrowUp"].includes(e.key)
          ? -1
          : 0;
      if (!direction && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? categoryButtons.length - 1
            : (index + direction + categoryButtons.length) % categoryButtons.length;
      categoryButtons[next].focus();
      setCategory(categoryButtons[next].dataset.category);
    });
  });
  const facetGroups = {
    roast: document.getElementById("catalog-roast-options"),
    processing: document.getElementById("catalog-processing-options"),
    taste: document.getElementById("catalog-taste-options"),
  };
  for (const [key, parent] of Object.entries(facetGroups))
    for (const [value, label] of Object.entries(names[key])) {
      const button = n(
        "button",
        {
          class: "catalog-filter-chip",
          type: "button",
          "data-filter-key": key,
          "data-filter-value": value,
          "aria-pressed": "false",
        },
        ...(key === "roast"
          ? [n("span", { class: `catalog-roast-dot is-${value}`, "aria-hidden": "true" })]
          : []),
        n("span", { text: label }),
        n("span", { class: "catalog-chip-count", "aria-hidden": "true" }),
      );
      button.addEventListener("click", () => {
        if (button.getAttribute("aria-disabled") === "true") return;
        if (key === "taste")
          options.taste = options.taste.includes(value)
            ? options.taste.filter((v) => v !== value)
            : [...options.taste, value];
        else options[key] = options[key] === value ? "" : value;
        change();
      });
      parent.append(button);
    }
  favoriteFilter.addEventListener("click", () => {
    if (favoriteFilter.getAttribute("aria-disabled") === "true") return;
    options.favorites = !options.favorites;
    change();
  });
  function clearAll() {
    Object.assign(options, {
      q: "",
      origin: "",
      roast: "",
      processing: "",
      taste: [],
      price: "",
      method: "",
      stock: false,
      favorites: false,
    });
    syncFields();
    change();
  }
  reset.addEventListener("click", clearAll);
  document.getElementById("catalog-empty-reset").addEventListener("click", clearAll);
  let sheetOpener = null;
  function openFilters(opener) {
    if (mobile.matches) {
      sheetOpener = opener;
      sheetContent.append(filterBody);
      advanced.hidden = false;
      dialog.showModal();
      document.body.classList.add("catalog-sheet-open");
      dialog.querySelector("[data-close-filters]").focus();
    } else {
      expanded = !expanded;
      advanced.hidden = !expanded;
      form.classList.toggle("filters-expanded", expanded);
    }
    more.setAttribute("aria-expanded", String(mobile.matches ? dialog.open : expanded));
    stickyToggle.setAttribute("aria-expanded", String(mobile.matches ? dialog.open : expanded));
  }
  more.addEventListener("click", () => openFilters(more));
  stickyToggle.addEventListener("click", () => openFilters(stickyToggle));
  dialog.querySelector("[data-close-filters]").addEventListener("click", () => dialog.close());
  sheetApply.addEventListener("click", () => {
    dialog.close();
    count.focus({ preventScroll: true });
    document.querySelector(".catalog-results-bar").scrollIntoView({ block: "nearest" });
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    filterHome.append(filterBody);
    advanced.hidden = !expanded;
    document.body.classList.remove("catalog-sheet-open");
    more.setAttribute("aria-expanded", String(expanded));
    stickyToggle.setAttribute("aria-expanded", String(expanded));
    sheetOpener?.focus({ preventScroll: true });
  });
  mobile.addEventListener("change", () => {
    if (dialog.open) dialog.close();
  });
  const sentinel = document.getElementById("catalog-toolbar-sentinel");
  new IntersectionObserver(
    ([entry]) => {
      const compact = entry.boundingClientRect.top < 0 && !entry.isIntersecting;
      form.classList.toggle("is-compact", compact);
      if (!compact) {
        expanded = false;
        advanced.hidden = true;
        form.classList.remove("filters-expanded");
        more.setAttribute("aria-expanded", "false");
        stickyToggle.setAttribute("aria-expanded", "false");
      }
    },
    { threshold: 0 },
  ).observe(sentinel);
  window.addEventListener("popstate", () => {
    clearTimeout(searchTimer);
    options = readOptions();
    syncFields();
    render();
  });
  syncFields();
  function svg(kind) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      class: "catalog-icon",
    }))
      node.setAttribute(key, value);
    const path = document.createElementNS(node.namespaceURI, "path");
    path.setAttribute(
      "d",
      kind === "eye"
        ? "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
        : "M7 4h14v16H7zM3 8v12",
    );
    node.append(path);
    return node;
  }
  function metric(key, label, value) {
    const available = Number.isFinite(value),
      score = available ? value / 10 : 0;
    const ticks = n(
      "span",
      { class: "catalog-taste-pips", "aria-hidden": "true" },
      ...Array.from({ length: 5 }, (_, index) =>
        n("span", { style: `--pip-fill:${Math.max(0, Math.min(100, (score - index * 2) * 50))}%` }),
      ),
    );
    return n(
      "div",
      { class: "catalog-taste-row", "data-taste": key },
      n("span", { text: label }),
      ticks,
      n("span", {
        class: "catalog-taste-value",
        title: available ? `${score} з 10` : "Оцінка залежить від обсмаження",
        text: available
          ? new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(score)
          : "—",
      }),
    );
  }
  function card(p, index = 0, presentation = {}) {
    const green = S.isGreen(p),
      country = p.originLabel.split(",")[0].trim(),
      short = p.name
        .replace(/ · зелене зерно$/, "")
        .replace(new RegExp("^" + country + "\\s+"), "");
    const state = presentation.availability || "available";
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
    const imgAttributes = {
      src: S.url(p.image),
      alt:
        p.imageAlt ||
        (green
          ? "Зелені кавові зерна"
          : `Зерна ${p.roast === "light" ? "світлого" : p.roast === "dark" ? "темного" : "середнього"} обсмаження`),
      width: 800,
      height: 533,
      loading: index < 3 ? "eager" : "lazy",
      decoding: "async",
      fetchpriority: index < 3 ? "high" : "auto",
    };
    // Existing photos illustrate roast levels; only responsive copies are new.
    if (
      p.imageResponsive ||
      (!green && /\/(ethiopia-guji|colombia-huila|brazil-cerrado)\.webp$/.test(p.image))
    ) {
      const base = p.image.replace(/^.*\//, "").replace(".webp", "");
      imgAttributes.src = S.url(`assets/images/coffee/responsive/${base}-800.webp`);
      imgAttributes.srcset = `${S.url(`assets/images/coffee/responsive/${base}-400.webp`)} 400w, ${S.url(`assets/images/coffee/responsive/${base}-800.webp`)} 800w`;
      imgAttributes.sizes =
        "(min-width:1280px) 340px, (min-width:768px) calc((100vw - 112px) / 2), calc(100vw - 80px)";
    }
    const quick = n(
      "button",
      {
        class: "catalog-quick-button mo-quick-open",
        type: "button",
        "data-mo-quick": p.id,
        title: "Швидкий перегляд · можна утримувати фото",
        "aria-haspopup": "dialog",
        "aria-controls": "mo-quick-view",
        "aria-label": `Швидкий перегляд: ${p.name}`,
      },
      svg("eye"),
    );
    const media = n(
      "div",
      { class: `product-media${green && p.imageKind !== "packaging" ? " is-green" : ""}` },
      n(
        "a",
        {
          class: "product-media-link",
          href: S.url(`products/${p.id}.html`),
          tabindex: -1,
          "aria-hidden": "true",
        },
        n("img", imgAttributes),
      ),
      n("span", {
        class: "catalog-photo-caption",
        text: green ? "Зелене зерно" : `${S.roasts[p.roast]} обсмаження`,
      }),
      quick,
    );
    const methods = green ? [] : S.brewingMethods(p);
    const tags = n(
      "div",
      { class: "catalog-method-tags" },
      n("abbr", { title: `Спосіб обробки зерна: ${p.processing}`, text: p.processing }),
      ...methods.map((value) =>
        n("span", {
          text: { espresso: "Для еспресо", filter: "Для фільтра", cezve: "Для джезви" }[value],
        }),
      ),
    );
    const scores = green ? p.tasteByRoast?.medium : p.taste;
    const taste = n(
      "div",
      {
        class: "catalog-taste",
        role: "group",
        "aria-label": "Орієнтовні смакові оцінки від 0 до 10",
      },
      n(
        "div",
        { class: "catalog-taste-caption" },
        n("span", {
          text: green
            ? "Після середнього обсмаження · орієнтовно"
            : "Смаковий профіль · орієнтовно",
        }),
        n("span", { text: "0–10" }),
      ),
      metric("acidity", "Кислотність", scores?.acidity),
      metric("sweetness", "Солодкість", scores?.sweetness),
      metric("bitterness", "Гіркота", scores?.bitterness),
      metric("strength", "Міцність", S.beanStrength({ id: p.id, roast: "medium" }) * 20),
    );
    const stock = n("span", {
      class: `catalog-stock is-${state}`,
      text:
        state === "low"
          ? "Закінчується"
          : state === "unavailable"
            ? "Немає в наявності"
            : "У наявності",
    });
    const add = n("button", {
      class: "button catalog-add-mix",
      type: "button",
      "data-add-bean": p.id,
      "aria-label": `До міксу: ${p.name}`,
      disabled: state === "unavailable",
      text: "До міксу",
    });
    add.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (add.disabled || add.getAttribute("aria-disabled") === "true" || mixWrites.has(p.id))
        return;
      mixWrites.add(p.id);
      add.setAttribute("aria-busy", "true");
      try {
        if (S.get().draft.beans.some((bean) => bean.id === p.id)) {
          let removed = false;
          const persisted = await S.update((state) => {
            const index = state.draft.beans.findIndex((bean) => bean.id === p.id);
            if (index < 0) return false;
            state.draft.beans.splice(index, 1);
            removed = true;
          });
          if (removed)
            S.notify(
              persisted
                ? "Сорт прибрано з міксу."
                : "Сорт прибрано лише на цій сторінці. Браузер не зберіг зміни.",
              null,
              persisted ? "success" : "warning",
            );
        } else await S.addBean(p.id);
      } catch {
        S.notify("Не вдалося змінити склад міксу. Спробуйте ще раз.");
      } finally {
        mixWrites.delete(p.id);
        syncMix();
      }
    });
    const buy =
      state === "unavailable"
        ? n("button", {
            class: "button button-secondary",
            type: "button",
            disabled: true,
            "aria-label": `Повідомити про появу ${p.name}. Скоро.`,
            text: "Повідомити · скоро",
          })
        : n("a", {
            class: "button button-secondary",
            href: S.url(`products/${p.id}.html#product-purchase`),
            "aria-label": `Купити ${p.name}: обрати вагу та помел`,
            text: "Купити",
          });
    return n(
      "li",
      {},
      n(
        "article",
        {
          class: "card product-card catalog-product",
          "data-product": p.id,
          "aria-labelledby": `catalog-${p.id}`,
        },
        media,
        n(
          "div",
          { class: "catalog-product-heading" },
          n(
            "div",
            { class: "catalog-product-heading-copy" },
            n("p", { class: "eyebrow", text: country }),
            n(
              "h3",
              { id: `catalog-${p.id}` },
              n("a", {
                class: "product-title-link",
                href: S.url(`products/${p.id}.html`),
                "aria-label": `${p.name} — детальніше`,
                text: short,
              }),
            ),
          ),
          favorite,
        ),
        n("p", { class: "catalog-product-notes", text: p.notes.split(/[.;]/)[0] }),
        tags,
        taste,
        n(
          "div",
          { class: "catalog-product-price" },
          n(
            "div",
            { class: "catalog-price-main" },
            n("p", { class: "price", text: S.money(p.price) }),
            n("span", { class: "catalog-unit", text: "за 250 г" }),
            stock,
          ),
          n("p", {
            class: "catalog-comparison-price",
            text: `${S.money(Math.round((p.price * 100) / 250))} / 100 г`,
          }),
        ),
        n("div", { class: "catalog-product-actions" }, add, buy),
      ),
    );
  }
  const tray = document.getElementById("catalog-mix-tray"),
    traySlots = document.getElementById("catalog-tray-slots"),
    trayCount = document.getElementById("catalog-tray-count"),
    trayNames = document.getElementById("catalog-tray-names"),
    trayLink = document.getElementById("catalog-tray-link"),
    limit = document.getElementById("catalog-mix-limit");
  let floatingFrame = 0;
  function resizeTray() {
    floatingFrame = 0;
    const footer = document.querySelector(".site-footer");
    tray.classList.toggle(
      "is-docked",
      !tray.hidden && Boolean(footer) && footer.getBoundingClientRect().top <= innerHeight,
    );
    const rect = tray.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--catalog-tray-height",
      `${Math.ceil(rect.height)}px`,
    );
    const notice = document.getElementById("shop-notice");
    const noticeHeight = notice && !notice.hidden ? notice.getBoundingClientRect().height : 140;
    if (!tray.hidden && rect.bottom > 0 && rect.top < innerHeight && rect.top >= noticeHeight + 28)
      document.documentElement.style.setProperty(
        "--shop-notice-bottom",
        `${Math.ceil(innerHeight - rect.top + 12)}px`,
      );
    else document.documentElement.style.removeProperty("--shop-notice-bottom");
  }
  function queueFloatingLayout() {
    if (!floatingFrame) floatingFrame = requestAnimationFrame(resizeTray);
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(resizeTray).observe(tray);
  window.addEventListener("resize", queueFloatingLayout);
  window.addEventListener("scroll", queueFloatingLayout, { passive: true });
  window.addEventListener("coffee:notice", resizeTray);
  trayLink.addEventListener("click", async (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (await S.update(() => {})) location.href = trayLink.href;
    else S.notify("Браузер не зберігає вибір для переходу. Дозвольте сховище та спробуйте ще раз.");
  });
  function syncMix() {
    const focusedRemove = document.activeElement?.closest("[data-tray-remove]");
    const focusedSlot = focusedRemove?.dataset.slot;
    const m = S.get().draft,
      full = m.beans.length >= 4;
    tray.hidden = !m.beans.length;
    document.body.classList.toggle("has-catalog-tray", Boolean(m.beans.length));
    const message = `Ваш мікс: ${m.beans.length} з 4`;
    if (trayCount.textContent !== message) trayCount.textContent = message;
    trayNames.textContent = m.beans
      .map((b) => {
        const product = S.byId.get(b.id);
        const country = product?.originLabel.split(",")[0].trim();
        const name = (product?.name || "Кава")
          .replace(`${country} `, "")
          .replace(" · зелене зерно", " · зелене");
        return `${String.fromCharCode(65 + b.slot)}: ${name}`;
      })
      .join(" · ");
    trayNames.title = m.beans.map((b) => S.byId.get(b.id)?.name || "Кава").join(" · ");
    traySlots.replaceChildren(
      ...Array.from({ length: 4 }, (_, slot) => {
        const bean = m.beans.find((b) => b.slot === slot),
          name = bean ? S.byId.get(bean.id)?.name : "Вільний слот";
        const tile = n("span", {
          class: `catalog-tray-slot${bean ? " is-filled" : ""}`,
          role: "listitem",
          "data-color": slot,
          title: `${String.fromCharCode(65 + slot)} — ${name}`,
          "aria-label": `Слот ${String.fromCharCode(65 + slot)}: ${name}`,
          text: String.fromCharCode(65 + slot),
        });
        if (bean) {
          const remove = n(
            "button",
            {
              class: "catalog-tray-remove",
              type: "button",
              "data-tray-remove": bean.id,
              "data-slot": slot,
              "aria-label": `Прибрати ${name} з міксу, слот ${String.fromCharCode(65 + slot)}`,
              title: `Прибрати ${name} з міксу`,
              "aria-busy": String(mixWrites.has(bean.id)),
            },
            n("span", { "aria-hidden": "true", text: "×" }),
          );
          remove.addEventListener("click", async () => {
            if (mixWrites.has(bean.id)) return;
            mixWrites.add(bean.id);
            remove.setAttribute("aria-busy", "true");
            try {
              let removed = false;
              const persisted = await S.update((state) => {
                const index = state.draft.beans.findIndex((item) => item.id === bean.id);
                if (index < 0) return false;
                state.draft.beans.splice(index, 1);
                removed = true;
              });
              if (removed)
                S.notify(
                  persisted
                    ? "Сорт прибрано з міксу."
                    : "Сорт прибрано лише на цій сторінці. Браузер не зберіг зміни.",
                  null,
                  persisted ? "success" : "warning",
                );
            } catch {
              S.notify("Не вдалося змінити склад міксу. Спробуйте ще раз.");
            } finally {
              mixWrites.delete(bean.id);
              syncMix();
            }
          });
          tile.append(remove);
        }
        return tile;
      }),
    );
    if (focusedSlot !== undefined) {
      const buttons = [...traySlots.querySelectorAll("[data-tray-remove]:not(:disabled)")];
      const target =
        buttons.find((button) => button.dataset.slot === focusedSlot) ||
        buttons.find((button) => Number(button.dataset.slot) > Number(focusedSlot)) ||
        buttons.at(-1) ||
        (!tray.hidden ? trayLink : grid.querySelector("[data-add-bean]")) ||
        form.querySelector("input");
      target?.focus({ preventScroll: true });
    }
    limit.hidden = !full;
    for (const button of grid.querySelectorAll("[data-add-bean]")) {
      const bean = m.beans.find((b) => b.id === button.dataset.addBean),
        locked = !bean && full;
      button.textContent = bean ? `У міксі ${String.fromCharCode(65 + bean.slot)} ✓` : "До міксу";
      button.classList.toggle("is-in-mix", Boolean(bean));
      button.setAttribute("aria-disabled", String(locked));
      button.setAttribute("aria-pressed", String(Boolean(bean)));
      button.setAttribute("aria-busy", String(mixWrites.has(button.dataset.addBean)));
      button.setAttribute(
        "aria-label",
        bean
          ? `У міксі ${String.fromCharCode(65 + bean.slot)}: ${S.byId.get(bean.id).name}. Натисніть, щоб прибрати сорт.`
          : `До міксу: ${S.byId.get(button.dataset.addBean).name}`,
      );
      button.title = bean
        ? "Натисніть, щоб прибрати сорт із міксу."
        : full
          ? "Максимум чотири сорти. Приберіть один кнопкою «У міксі», щоб додати інший."
          : "";
      if (full && !bean) button.setAttribute("aria-describedby", "catalog-mix-limit");
      else button.removeAttribute("aria-describedby");
    }
    resizeTray();
  }
  function render() {
    if (options.category === "green") {
      options.roast = "";
      options.method = "";
    } else options.processing = "";
    if (!S.get().favorites.length) options.favorites = false;
    syncFields();
    const state = S.get(),
      current = document.activeElement,
      focus = current?.closest("[data-favorite],[data-add-bean]"),
      focusKey = focus?.hasAttribute("data-favorite") ? "data-favorite" : "data-add-bean",
      focusId = focus?.getAttribute(focusKey),
      oldButtons = focus ? [...grid.querySelectorAll(`[${focusKey}]`)] : [],
      focusIndex = oldButtons.indexOf(focus);
    const total = S.products.filter((p) => S.isGreen(p) === (options.category === "green")),
      products = S.products.filter((p) => matches(p));
    if (options.sort === "price-ascending") products.sort((a, b) => a.price - b.price);
    if (options.sort === "price-descending") products.sort((a, b) => b.price - a.price);
    if (options.sort === "name") products.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    grid.replaceChildren(
      ...products.map((p, index) => card(p, index, { availability: availability(p) })),
    );
    grid.hidden = !products.length;
    empty.hidden = Boolean(products.length);
    const resultText = `Показано ${products.length} із ${total.length} сортів`;
    if (count.textContent !== resultText) count.textContent = resultText;
    sheetApply.textContent = `Показати ${products.length} ${products.length % 10 === 1 && products.length % 100 !== 11 ? "сорт" : products.length % 10 >= 2 && products.length % 10 <= 4 && !(products.length % 100 >= 12 && products.length % 100 <= 14) ? "сорти" : "сортів"}`;
    greenHelp.hidden = options.category !== "green";
    document.getElementById("catalog-roast-group").hidden = options.category === "green";
    document.getElementById("catalog-processing-group").hidden = options.category !== "green";
    document.getElementById("catalog-method-field").hidden = options.category === "green";
    for (const button of categoryButtons) {
      const selected = button.dataset.category === options.category;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle("catalog-category-current", selected);
      button.querySelector(".catalog-category-count").textContent = S.products.filter(
        (p) => S.isGreen(p) === (button.dataset.category === "green"),
      ).length;
    }
    for (const button of filterBody.querySelectorAll("[data-filter-key]")) {
      const key = button.dataset.filterKey,
        value = button.dataset.filterValue,
        selected = key === "taste" ? options.taste.includes(value) : options[key] === value;
      const amount = S.products.filter(
        (p) =>
          matches(p, options, key) &&
          (key === "taste" ? p.profiles.includes(value) : p[key] === value),
      ).length;
      button.querySelector(".catalog-chip-count").textContent = amount;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-disabled", String(!amount && !selected));
      button.setAttribute(
        "aria-label",
        `${names[key][value]}: ${amount} сортів${selected ? ", вибрано" : ""}`,
      );
      button.title =
        !amount && !selected
          ? "Немає сортів за поточними фільтрами"
          : key === "taste"
            ? "Можна обрати кілька смаків"
            : "";
    }
    favoriteFilter.querySelector("#catalog-favorite-count").textContent = state.favorites.length;
    favoriteFilter.setAttribute("aria-pressed", String(options.favorites));
    favoriteFilter.setAttribute("aria-disabled", String(!state.favorites.length));
    favoriteFilter.title = state.favorites.length
      ? "Показати лише обрані сорти"
      : "Додайте сорт до обраного серцем";
    for (const key of ["origin", "price", "method"])
      for (const option of form.elements[key].options) {
        if (!option.value) continue;
        const amount = S.products.filter((p) =>
          matches(p, { ...options, [key]: option.value }),
        ).length;
        option.disabled = !amount && options[key] !== option.value;
      }
    const chips = [];
    const addChip = (key, value, label) => {
      const button = n(
        "button",
        { class: "catalog-active-chip", type: "button", "aria-label": `Прибрати фільтр: ${label}` },
        n("span", { text: label }),
        n("span", { "aria-hidden": "true", text: "×" }),
      );
      button.addEventListener("click", () => {
        if (key === "taste") options.taste = options.taste.filter((v) => v !== value);
        else options[key] = ["favorites", "stock"].includes(key) ? false : "";
        syncFields();
        change();
        (reset.hidden ? count : reset).focus({ preventScroll: true });
      });
      chips.push(button);
    };
    for (const [key, value] of Object.entries(options)) {
      if (!value || key === "category" || key === "sort") continue;
      if (key === "taste") {
        value.forEach((v) => addChip(key, v, names.taste[v]));
        continue;
      }
      const label =
        key === "q"
          ? `Пошук: ${value}`
          : key === "origin"
            ? countries.get(value)
            : key === "favorites"
              ? "Лише обране"
              : key === "stock"
                ? "У наявності"
                : names[key]?.[value];
      if (label) addChip(key, value, label);
    }
    activeFilters.replaceChildren(...chips);
    activeFilters.hidden = !chips.length;
    reset.hidden = !chips.length;
    const extraCount = ["origin", "price", "method", "stock"].filter((k) => options[k]).length;
    document.getElementById("catalog-more-count").textContent = extraCount
      ? ` · ${extraCount}`
      : "";
    for (const button of grid.querySelectorAll("[data-favorite]")) {
      const selected = state.favorites.includes(button.dataset.favorite);
      button.classList.toggle("is-favorite", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-label",
        `${selected ? "Прибрати" : "Додати"} каву «${S.byId.get(button.dataset.favorite).name}» ${selected ? "з обраного" : "до обраного"}`,
      );
    }
    syncMix();
    if (focusId) {
      const buttons = [...grid.querySelectorAll(`[${focusKey}]`)];
      (
        buttons.find((b) => b.getAttribute(focusKey) === focusId) ||
        buttons[Math.min(focusIndex, buttons.length - 1)] ||
        count
      ).focus({ preventScroll: true });
    }
  }
  window.CoffeeCatalogUI = Object.freeze({ card, matches });
  window.addEventListener("coffee:change", (event) => {
    const changed = event.detail?.changed;
    if (!changed || changed.includes("favorites")) {
      render();
      if (new URLSearchParams(location.search).has("favorites") && !options.favorites)
        writeURL("replace");
    } else if (changed.includes("draft")) syncMix();
  });
  render();
  writeURL("replace");
})();
