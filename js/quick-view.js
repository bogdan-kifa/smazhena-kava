/* Accessible quick view and cancellable photo long-press; shop state remains owned by CoffeeShop. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    grid = document.querySelector(".catalog-grid");
  if (!S || !grid) return;
  const n = S.node,
    moving = matchMedia("(prefers-reduced-motion: no-preference)");
  const quick = n("dialog", {
    id: "mo-quick-view",
    class: "mo-quick-dialog",
    "aria-label": "Швидкий перегляд кави",
  });
  document.body.append(quick);
  let view = null,
    opener = null,
    pointer = null,
    blockClick = null,
    ignoreBackdropUntil = 0;
  const mixPending = new Set(),
    cartPending = new Set();
  const format = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 });
  function message(v, text, error = false) {
    if (view !== v) return;
    v.message.textContent = text;
    v.message.dataset.error = String(error);
  }
  function syncMix() {
    if (!view) return;
    const draft = S.get().draft,
      bean = draft.beans.find((b) => b.id === view.product.id),
      full = draft.beans.length >= 4;
    view.mix.textContent = bean ? `У міксі ${String.fromCharCode(65 + bean.slot)} ✓` : "До міксу";
    view.mix.setAttribute("aria-pressed", String(Boolean(bean)));
    view.mix.setAttribute(
      "aria-label",
      bean ? `Прибрати ${view.product.name} з міксу` : `Додати ${view.product.name} до міксу`,
    );
    view.mix.disabled = mixPending.has(view.product.id) || (!bean && (full || view.unavailable));
    view.mix.setAttribute("aria-busy", String(mixPending.has(view.product.id)));
    view.mix.classList.toggle("mo-quick-in-mix", Boolean(bean));
    view.limit.hidden = !full || Boolean(bean);
    view.buy.disabled = cartPending.has(view.product.id) || view.unavailable;
    view.buy.setAttribute("aria-busy", String(cartPending.has(view.product.id)));
  }
  function profile(v) {
    const p = v.product,
      green = S.isGreen(p),
      chosen = v.roast?.value || "raw",
      roast = chosen === "raw" ? "medium" : chosen;
    const taste = green ? p.tasteByRoast?.[roast] : p.taste;
    const strength = green ? p.strengthByRoast?.[roast] : p.strength;
    const scores = { ...taste, strength: Number.isFinite(strength) ? strength * 20 : null };
    const names = { light: "світлого", medium: "середнього", dark: "темного" };
    if (green && v.notes)
      v.notes.textContent = (p.notesByRoast?.[roast] || p.notes).split(/[.;]/)[0];
    const caption = green
      ? `Після ${names[roast]} обсмаження · орієнтовно`
      : "Смаковий профіль · орієнтовно";
    v.profile.replaceChildren(
      n("h3", { class: "mo-quick-profile-title", text: caption }),
      n("p", { class: "mo-quick-scale", text: "Шкала 0–10" }),
    );
    for (const [key, label] of [
      ["acidity", "Кислотність"],
      ["sweetness", "Солодкість"],
      ["bitterness", "Гіркота"],
      ["strength", "Міцність"],
    ]) {
      const available = Number.isFinite(scores[key]),
        score = available ? scores[key] / 10 : 0;
      v.profile.append(
        n(
          "div",
          { class: "catalog-taste-row", "data-taste": key },
          n("span", { text: label }),
          n(
            "span",
            { class: "catalog-taste-pips", "aria-hidden": "true" },
            ...Array.from({ length: 5 }, (_, i) =>
              n("span", {
                style: `--pip-fill:${Math.max(0, Math.min(100, (score - i * 2) * 50))}%`,
              }),
            ),
          ),
          n("span", {
            class: "catalog-taste-value",
            "aria-label": `${label}: ${available ? format.format(score) + " з 10" : "немає оцінки"}`,
            text: available ? format.format(score) : "—",
          }),
        ),
      );
    }
  }
  function selectField(id, label, options) {
    const select = n(
      "select",
      { id, class: "mo-quick-select" },
      ...options.map(([value, text]) => n("option", { value, text })),
    );
    return {
      select,
      field: n("div", { class: "mo-quick-field" }, n("label", { for: id, text: label }), select),
    };
  }
  function open(id, trigger, held = false) {
    const product = S.byId.get(id);
    if (!product || quick.open) return;
    opener = trigger;
    ignoreBackdropUntil = held ? Infinity : 0;
    const v = { product, weight: 250, unavailable: !S.available(product) };
    view = v;
    const close = n("button", {
      class: "mo-quick-close",
      type: "button",
      "aria-label": "Закрити швидкий перегляд",
      text: "×",
    });
    close.addEventListener("click", () => quick.close());
    const green = S.isGreen(product);
    const photo = n(
      "div",
      { class: "mo-quick-photo" },
      n("img", {
        src: S.url(product.image),
        alt: product.imageAlt || `Упаковка: ${product.name}`,
        width: 1536,
        height: 1024,
        decoding: "async",
      }),
    );
    const info = n(
      "div",
      { class: "mo-quick-information" },
      n("p", {
        class: "mo-quick-eyebrow",
        text: green ? "Зелене зерно" : `${S.roasts[product.roast]} обсмаження`,
      }),
      n("h2", { id: "mo-quick-title", text: product.name }),
      n("p", { class: "mo-quick-notes", text: product.notes.split(/[.;]/)[0] }),
    );
    v.notes = info.querySelector(".mo-quick-notes");
    v.profile = n("section", {
      class: "mo-quick-profile",
      "aria-label": "Орієнтовний смаковий профіль",
    });
    info.append(v.profile);
    const weights = n("fieldset", { class: "mo-quick-weights" }, n("legend", { text: "Вага" })),
      weightOptions = n("div", { class: "mo-quick-weight-options" });
    for (const value of [250, 500, 1000]) {
      const input = n("input", {
        id: `mo-quick-weight-${value}`,
        name: "mo-quick-weight",
        type: "radio",
        value,
        checked: value === 250,
        class: "visually-hidden",
      });
      input.addEventListener("change", () => {
        v.weight = value;
        v.price.textContent = S.money(S.productPrice(product, value));
      });
      weightOptions.append(
        input,
        n("label", { for: `mo-quick-weight-${value}`, text: `${value} г` }),
      );
    }
    weights.append(weightOptions);
    info.append(weights);
    if (green) {
      const roast = selectField("mo-quick-roast", "Обсмаження", [
        ["raw", "Зелене зерно · без обсмаження"],
        ...Object.entries(S.roasts).map(([key, text]) => [key, `${text} · без доплати`]),
      ]);
      v.roast = roast.select;
      info.append(roast.field);
    }
    const grind = selectField("mo-quick-grind", "Помел", [
      ["", "Оберіть помел"],
      ...Object.entries(S.grinds),
    ]);
    v.grind = grind.select;
    v.grind.setAttribute("aria-describedby", "mo-quick-grind-help");
    v.grindHelp = n("p", {
      id: "mo-quick-grind-help",
      class: "mo-quick-help",
      "aria-live": "polite",
      hidden: true,
    });
    grind.field.append(v.grindHelp);
    info.append(grind.field);
    v.grind.value = green ? "beans" : "";
    function updateGrind() {
      const raw = green && v.roast.value === "raw";
      v.grind.disabled = raw;
      if (raw) v.grind.value = "beans";
      v.grind.removeAttribute("aria-invalid");
      v.grindHelp.dataset.error = "false";
      v.grindHelp.hidden = !raw;
      v.grindHelp.textContent = raw ? "Зелене зерно продається без помелу." : "";
    }
    v.grind.addEventListener("change", updateGrind);
    v.roast?.addEventListener("change", () => {
      updateGrind();
      profile(v);
    });
    v.price = n("strong", { class: "mo-quick-price", text: S.money(product.price) });
    v.mix = n("button", { class: "button mo-quick-mix", type: "button", text: "До міксу" });
    v.buy = n("button", {
      class: "button button-secondary mo-quick-buy",
      type: "button",
      text: "У кошик",
      "aria-describedby": "mo-quick-grind-help",
    });
    v.limit = n("p", {
      class: "mo-quick-help",
      text: "У міксі вже чотири сорти. Приберіть один, щоб додати інший.",
      hidden: true,
    });
    v.mix.setAttribute("aria-describedby", "mo-quick-mix-limit");
    v.limit.id = "mo-quick-mix-limit";
    v.message = n("p", {
      class: "mo-quick-feedback",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    v.mix.addEventListener("click", async () => {
      if (mixPending.has(id)) return;
      mixPending.add(id);
      syncMix();
      try {
        const selected = S.get().draft.beans.some((b) => b.id === id);
        if (selected) {
          const ok = await S.update((state) => {
            const index = state.draft.beans.findIndex((b) => b.id === id);
            if (index < 0) return false;
            state.draft.beans.splice(index, 1);
          });
          message(v, ok ? "Сорт прибрано з міксу." : "Не вдалося зберегти зміну міксу.", !ok);
        } else {
          const ok = await S.addBean(
            id,
            v.roast?.value === "raw" ? "medium" : v.roast?.value || "medium",
          );
          message(
            v,
            ok
              ? "Сорт додано до міксу."
              : "Не вдалося додати сорт. Перевірте склад міксу й збереження даних.",
            !ok,
          );
        }
      } catch {
        message(v, "Не вдалося змінити склад міксу. Спробуйте ще раз.", true);
      } finally {
        mixPending.delete(id);
        syncMix();
      }
    });
    v.buy.addEventListener("click", async () => {
      if (cartPending.has(id)) return;
      if (!v.grind.value) {
        v.grindHelp.textContent = "Оберіть помел, щоб додати каву до кошика.";
        v.grindHelp.hidden = false;
        v.grindHelp.dataset.error = "true";
        v.grind.setAttribute("aria-invalid", "true");
        v.grind.focus();
        return;
      }
      cartPending.add(id);
      syncMix();
      try {
        const ok = await S.addProduct(id, v.weight, v.grind.value, 1, v.roast?.value || "raw");
        message(
          v,
          ok ? "Каву додано до кошика." : "Не вдалося додати каву до кошика. Спробуйте ще раз.",
          !ok,
        );
      } catch {
        message(v, "Не вдалося додати каву до кошика. Спробуйте ще раз.", true);
      } finally {
        cartPending.delete(id);
        syncMix();
      }
    });
    const actions = n(
      "div",
      { class: "mo-quick-actions" },
      n("div", { class: "mo-quick-price-line" }, n("span", { text: "Ціна" }), v.price),
      n("div", { class: "mo-quick-buttons" }, v.mix, v.buy),
    );
    info.append(
      v.limit,
      v.message,
      n("a", {
        class: "mo-quick-more",
        href: S.url(`products/${id}.html`),
        text: "Докладніше про каву →",
      }),
    );
    quick.replaceChildren(
      close,
      n("div", { class: "mo-quick-scroll" }, n("div", { class: "mo-quick-layout" }, photo, info)),
      actions,
    );
    quick.setAttribute("aria-labelledby", "mo-quick-title");
    updateGrind();
    profile(v);
    syncMix();
    if (v.unavailable) message(v, "Немає в наявності.", true);
    quick.showModal();
    document.body.classList.add("mo-quick-active");
    close.focus({ preventScroll: true });
  }
  quick.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...quick.querySelectorAll(
        "button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled)",
      ),
    ].filter((el) => !el.closest("[hidden]") && (el.type !== "radio" || el.checked));
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  quick.addEventListener("close", () => {
    const id = view?.product.id;
    view = null;
    document.body.classList.remove("mo-quick-active");
    const target = opener?.isConnected
      ? opener
      : [...grid.querySelectorAll("[data-mo-quick]")].find((el) => el.dataset.moQuick === id);
    (target || document.getElementById("catalog-result-count"))?.focus({ preventScroll: true });
  });
  quick.addEventListener("click", (event) => {
    if (event.target !== quick || performance.now() < ignoreBackdropUntil) return;
    const r = quick.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      quick.close();
  });
  addEventListener("coffee:change", syncMix);
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mo-quick]");
    if (button) {
      event.preventDefault();
      open(button.dataset.moQuick, button);
    }
  });
  function cancelHold() {
    if (pointer) clearTimeout(pointer.timer);
    pointer = null;
  }
  grid.addEventListener("pointerdown", (event) => {
    cancelHold();
    const link = event.target.closest(".product-media-link");
    if (
      !link ||
      event.button !== 0 ||
      event.isPrimary === false ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const id = link.closest("[data-product]")?.dataset.product;
    if (!S.byId.has(id)) return;
    const hold = { id: event.pointerId, x: event.clientX, y: event.clientY, link, timer: null };
    pointer = hold;
    hold.timer = setTimeout(() => {
      if (pointer !== hold || !link.isConnected) return;
      blockClick = { link, until: Infinity };
      open(id, link.closest(".product-media").querySelector("[data-mo-quick]"), true);
      cancelHold();
    }, 400);
  });
  addEventListener(
    "pointermove",
    (event) => {
      if (
        pointer &&
        pointer.id === event.pointerId &&
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8
      )
        cancelHold();
    },
    { passive: true },
  );
  function releasedHold() {
    cancelHold();
    if (ignoreBackdropUntil === Infinity) ignoreBackdropUntil = performance.now() + 200;
    if (blockClick?.until === Infinity) blockClick.until = performance.now() + 600;
  }
  addEventListener("pointerup", releasedHold, { passive: true });
  addEventListener("pointercancel", releasedHold, { passive: true });
  addEventListener("scroll", cancelHold, { passive: true, capture: true });
  addEventListener("blur", cancelHold);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelHold();
  });
  grid.addEventListener(
    "click",
    (event) => {
      if (
        blockClick &&
        performance.now() < blockClick.until &&
        blockClick.link.contains(event.target)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        blockClick = null;
      }
    },
    true,
  );
  grid.addEventListener("contextmenu", (event) => {
    if (
      event.target.closest(".product-media-link") &&
      (pointer ||
        (blockClick && performance.now() < blockClick.until) ||
        event.pointerType === "touch")
    )
      event.preventDefault();
  });
  grid.addEventListener("dragstart", (event) => {
    if (event.target.closest(".product-media-link")) event.preventDefault();
  });
})();
