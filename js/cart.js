(() => {
  "use strict";
  const S = window.CoffeeShop;
  if (!S || !document.querySelector(".cart-items")) return;
  const { node: n } = S,
    $ = (id) => document.getElementById(id);
  const list = document.querySelector(".cart-items"),
    reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const money = (value) => S.money(value).replace(/\s+₴/u, "\u00a0₴");
  const countText = (count) =>
    `${count} ${count % 10 === 1 && count % 100 !== 11 ? "товар" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "товари" : "товарів"}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const recipeKey = (mix) =>
    JSON.stringify([
      mix.name,
      [...mix.beans].sort((a, b) => a.id.localeCompare(b.id)).map(({ slot, ...bean }) => bean),
      mix.weight,
      mix.grind,
      mix.packaging,
    ]);
  let previousTotal = null,
    previousCount = null,
    undoEntry = null,
    undoTimer,
    undoRemaining = 2000,
    undoStarted = 0;
  let animation = 0,
    detailsOpener;
  const pending = new Set();
  function focusControl(control) {
    if (!control) return;
    const controls = [...list.querySelectorAll("[data-control]")];
    (
      controls.find((el) => el.dataset.control === control && !el.disabled) ||
      controls.find((el) => el.dataset.control === control.replace(/:(minus|plus)$/, ":input"))
    )?.focus({ preventScroll: true });
  }
  function pauseUndo() {
    if (!undoTimer) return;
    clearTimeout(undoTimer);
    undoTimer = null;
    undoRemaining = Math.max(0, undoRemaining - (performance.now() - undoStarted));
  }
  function resumeUndo() {
    if (
      !undoEntry ||
      undoTimer ||
      $("mo-cart-undo").matches(":hover") ||
      $("mo-cart-undo").contains(document.activeElement)
    )
      return;
    undoStarted = performance.now();
    undoTimer = setTimeout(clearUndo, undoRemaining);
  }
  function clearUndo() {
    clearTimeout(undoTimer);
    undoTimer = null;
    undoEntry = null;
    if ($("mo-cart-undo").contains(document.activeElement))
      (list.querySelector("button,a") || $("mo-cart-heading")).focus({ preventScroll: true });
    $("mo-cart-undo").hidden = true;
  }
  function offerUndo(entry) {
    pauseUndo();
    undoEntry = entry;
    undoRemaining = 2000;
    $("mo-cart-undo-message").textContent = `Видалено: ${S.name(entry.item)}.`;
    $("mo-cart-undo").hidden = false;
    resumeUndo();
  }
  $("mo-cart-undo").addEventListener("pointerenter", pauseUndo);
  $("mo-cart-undo").addEventListener("pointerleave", resumeUndo);
  $("mo-cart-undo").addEventListener("focusin", pauseUndo);
  $("mo-cart-undo").addEventListener("focusout", () => setTimeout(resumeUndo, 0));
  $("mo-cart-undo-close").addEventListener("click", clearUndo);
  $("mo-cart-undo-button").addEventListener("click", async () => {
    const entry = undoEntry;
    if (!entry) return;
    const button = $("mo-cart-undo-button");
    button.disabled = true;
    const ok = await S.update((state) => {
      const same = state.cart.find(
        (item) =>
          S.lineKey(item) === S.lineKey(entry.item) ||
          (item.type === "mix" &&
            entry.item.type === "mix" &&
            recipeKey(item.mix) === recipeKey(entry.item.mix)),
      );
      if (same) {
        if (same.qty + entry.item.qty > 99) return false;
        same.qty += entry.item.qty;
      } else {
        if (state.cart.length >= 50) return false;
        state.cart.splice(Math.min(entry.index, state.cart.length), 0, clone(entry.item));
      }
    });
    button.disabled = false;
    if (ok) {
      clearUndo();
      focusControl(S.lineKey(entry.item) + ":remove");
    } else S.notify("Не вдалося повернути товар. Перевірте ліміти кількості та збереження кошика.");
  });
  async function editMix(event, item) {
    event.preventDefault();
    const current = S.get().cart.find((entry) => S.lineKey(entry) === S.lineKey(item));
    if (!current) {
      S.notify("Цього міксу вже немає в кошику.");
      return;
    }
    const ok = await S.update((state) => {
      state.draft = clone(current.mix);
    });
    if (ok) {
      const url = new URL(S.url("constructor.html"));
      url.searchParams.set("editCart", S.lineKey(current));
      location.href = url.href;
    } else S.notify("Не вдалося відкрити мікс. Дозвольте збереження даних браузера.");
  }
  function makeRow(item, index) {
    const id = S.lineKey(item),
      name = S.name(item),
      isMix = item.type === "mix";
    const product = S.byId.get(isMix ? item.mix.beans[0].id : item.id);
    const path = isMix ? "constructor.html" : `products/${item.id}.html`;
    const row = n("li", { "data-line-key": id });
    const change = async (qty, delta = null) => {
      const control = document.activeElement?.dataset.control;
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        S.notify("Кількість має бути цілим числом від 1 до 99.");
        render();
        focusControl(control);
        return;
      }
      const ok = await S.update((state) => {
        const current = state.cart.find((entry) => S.lineKey(entry) === id);
        if (!current) return false;
        current.qty = delta === null ? qty : Math.max(1, Math.min(99, current.qty + delta));
      });
      if (!ok) {
        render();
        S.notify("Не вдалося змінити кількість. Перевірте збереження кошика.");
      }
      focusControl(control);
    };
    const minus = n("button", {
      type: "button",
      class: "cart-quantity-button",
      disabled: item.qty === 1,
      "data-control": id + ":minus",
      "aria-label": `Зменшити кількість: ${name}`,
      text: "−",
    });
    const plus = n("button", {
      type: "button",
      class: "cart-quantity-button",
      disabled: item.qty === 99,
      "data-control": id + ":plus",
      "aria-label": `Збільшити кількість: ${name}`,
      text: "+",
    });
    const input = n("input", {
      class: "cart-quantity-input",
      type: "number",
      min: 1,
      max: 99,
      step: 1,
      value: item.qty,
      "data-control": id + ":input",
      "aria-label": `Кількість: ${name}`,
    });
    minus.addEventListener("click", () => change(item.qty - 1, -1));
    plus.addEventListener("click", () => change(item.qty + 1, 1));
    input.addEventListener("change", () => change(Number(input.value)));
    const remove = n("button", {
      type: "button",
      class: "cart-remove",
      "data-control": id + ":remove",
      "aria-label": `Видалити ${name} з кошика`,
      text: "Видалити",
    });
    remove.addEventListener("click", async () => {
      if (pending.has(id)) return;
      pending.add(id);
      row.classList.add("mo-cart-removing");
      row.setAttribute("aria-busy", "true");
      if (!reduce.matches) await new Promise((resolve) => setTimeout(resolve, 190));
      let entry;
      const ok = await S.update((state) => {
        const position = state.cart.findIndex((current) => S.lineKey(current) === id);
        if (position < 0) return false;
        entry = { item: clone(state.cart[position]), index: position };
        state.cart.splice(position, 1);
      });
      pending.delete(id);
      if (!ok) {
        render();
        focusControl(id + ":remove");
        S.notify("Не вдалося зберегти видалення. Товар залишився в кошику.");
        return;
      }
      offerUndo(entry);
      const next = S.get().cart[Math.min(index, S.get().cart.length - 1)];
      if (next) focusControl(S.lineKey(next) + ":remove");
      else $("mo-cart-empty-catalog").focus({ preventScroll: true });
    });
    const photo = n(
      "a",
      { class: "cart-item-photo", href: S.url(path), tabindex: "-1", "aria-hidden": "true" },
      n("img", {
        src: S.url(product.image),
        alt: "",
        width: 1536,
        height: 1024,
        loading: index < 2 ? "eager" : "lazy",
      }),
    );
    const titleLink = n("a", { href: S.url(path), text: name });
    const copy = n(
      "div",
      { class: "cart-item-copy" },
      n("h3", { class: "cart-item-title", id: `mo-cart-title-${index}` }, titleLink),
    );
    if (isMix) {
      copy.append(
        n("span", { class: "mo-cart-kind", text: "Власний мікс" }),
        n("p", {
          class: "mo-cart-composition",
          text: item.mix.beans
            .map(
              (bean) =>
                `${bean.ratio}% ${S.byId.get(bean.id).name}${S.isGreen(S.byId.get(bean.id)) ? ` (${S.roasts[bean.roast || "medium"].toLocaleLowerCase("uk-UA")})` : ""}`,
            )
            .join(" · "),
        }),
      );
      copy.append(
        n("p", {
          class: "muted",
          text: `${item.mix.weight}\u00a0г · ${S.grinds[item.mix.grind]} · ${S.packaging[item.mix.packaging].name}${S.packaging[item.mix.packaging].price ? ` (+${money(S.packaging[item.mix.packaging].price)})` : ""}`,
        }),
      );
      const edit = n("a", {
        href: S.url(path),
        class: "mo-cart-edit",
        text: "Редагувати мікс",
        "data-control": id + ":edit",
      });
      for (const link of [edit, titleLink, photo])
        link.addEventListener("click", (event) => editMix(event, item));
      copy.append(edit);
    } else {
      const roast = S.isGreen(product)
        ? item.roast === "raw" || !item.roast
          ? "Зелене зерно · без обсмаження"
          : `${S.roasts[item.roast]} обсмаження`
        : `${S.roasts[product.roast]} обсмаження`;
      copy.append(
        n("p", { class: "muted", text: roast }),
        n("p", { class: "muted", text: `${item.weight}\u00a0г · ${S.grinds[item.grind]}` }),
      );
    }
    copy.append(
      n(
        "div",
        { class: "cart-quantity", role: "group", "aria-label": `Кількість: ${name}` },
        minus,
        input,
        plus,
      ),
    );
    const prices = n(
      "div",
      { class: "cart-item-price" },
      n("p", { class: "cart-line-price", text: money(S.unit(item) * item.qty) }),
      n("p", { class: "mo-cart-unit", text: `${money(S.unit(item))} / шт.` }),
      remove,
    );
    row.append(
      n(
        "article",
        { class: "cart-item", "aria-labelledby": `mo-cart-title-${index}` },
        photo,
        copy,
        prices,
      ),
    );
    if (pending.has(id)) {
      row.classList.add("mo-cart-removing");
      row.setAttribute("aria-busy", "true");
    }
    return row;
  }
  function renderQuickAdd(state, total) {
    const box = $("mo-cart-quick-add");
    box.replaceChildren();
    box.hidden = true;
    if (!state.cart.length || total >= 80000) return;
    const candidates = state.favorites
      .map((id) => S.byId.get(id))
      .filter((p) => p && !S.isGreen(p) && p.available !== false);
    if (!candidates.length) return;
    const gap = 80000 - total;
    candidates.sort(
      (a, b) =>
        (a.price >= gap ? 0 : 1) - (b.price >= gap ? 0 : 1) ||
        Math.abs(a.price - gap) - Math.abs(b.price - gap),
    );
    const product = candidates.find(
      (p) =>
        !state.cart.some(
          (item) =>
            item.type === "product" &&
            item.id === p.id &&
            item.weight === 250 &&
            item.grind === "beans" &&
            item.qty >= 99,
        ),
    );
    if (!product) return;
    const button = n("button", {
      class: "mo-cart-quick-button",
      type: "button",
      text: `+ 250 г · ${money(product.price)}`,
      "aria-label": `Додати 250 г ${product.name} у зернах за ${money(product.price)}`,
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      await S.addProduct(product.id, 250, "beans");
      if (button.isConnected) button.disabled = false;
    });
    box.append(
      n("p", { class: "mo-cart-small", text: "З вашого обраного · у зернах" }),
      n("p", { class: "mo-cart-quick-name", text: product.name }),
      button,
    );
    box.hidden = false;
  }
  function animateTotal(total) {
    cancelAnimationFrame(animation);
    const elements = document.querySelectorAll("[data-mo-cart-total]");
    const from = previousTotal ?? total;
    if (reduce.matches || from === total) {
      elements.forEach((el) => {
        el.textContent = money(total);
      });
      return;
    }
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / 400);
      elements.forEach((el) => {
        el.textContent = money(
          Math.round((from + (total - from) * (1 - (1 - t) ** 3)) / 100) * 100,
        );
      });
      if (t < 1) animation = requestAnimationFrame(tick);
      else
        elements.forEach((el) => {
          el.textContent = money(total);
        });
    };
    animation = requestAnimationFrame(tick);
  }
  const dialog = $("mo-cart-details"),
    summary = $("mo-cart-summary-card");
  function homeSummary() {
    $("mo-cart-summary-home").append(summary);
    document.body.classList.remove("mo-cart-dialog-open");
    detailsOpener?.focus({ preventScroll: true });
  }
  $("mo-cart-details-open").addEventListener("click", () => {
    detailsOpener = document.activeElement;
    $("mo-cart-details-content").append(summary);
    dialog.showModal();
    document.body.classList.add("mo-cart-dialog-open");
    $("mo-cart-details-close").focus();
  });
  $("mo-cart-details-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", homeSummary);
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
  matchMedia("(min-width:768px)").addEventListener("change", (event) => {
    if (event.matches && dialog.open) dialog.close();
  });
  function render() {
    const oldFocus = document.activeElement?.dataset.control,
      state = S.get(),
      total = S.total(),
      empty = !state.cart.length;
    const count = state.cart.reduce((sum, item) => sum + item.qty, 0),
      free = total >= 80000;
    document.body.classList.toggle("mo-cart-empty", empty);
    $("mo-cart-count").textContent = empty ? "" : ` · ${countText(count)}`;
    $("cart-status").hidden = empty;
    $("mo-cart-empty-state").hidden = !empty;
    $("mo-cart-summary-home").hidden = empty;
    $("mo-cart-mobile-bar").hidden = empty;
    if (empty && dialog.open) dialog.close();
    list.replaceChildren(...state.cart.map(makeRow));
    const delivery = free ? "Безкоштовно" : "Розрахуємо на наступному кроці";
    $("mo-cart-items-total").textContent = money(total);
    $("mo-cart-shipping").textContent = delivery;
    $("cart-delivery-label").textContent = free
      ? "Доставка безкоштовна"
      : `Додайте ще на ${money(80000 - total)} — і доставка безкоштовна`;
    const progress = $("mo-cart-progress");
    progress.value = Math.min(total, 80000);
    progress.textContent = `${money(Math.min(total, 80000))} з ${money(80000)}`;
    $("mo-cart-progress-fill").style.transform = `scaleX(${Math.min(total / 80000, 1)})`;
    $("mo-cart-delivery").classList.toggle(
      "mo-cart-unlocked",
      free && previousTotal !== null && previousTotal < 80000,
    );
    $("mo-cart-summary-live").textContent = empty
      ? "Кошик порожній"
      : `${countText(count)}. Разом ${money(total)}. Доставка: ${delivery}.`;
    renderQuickAdd(state, total);
    animateTotal(total);
    if (previousCount !== null && count > previousCount && !reduce.matches)
      document
        .querySelector("header .cart-count")
        ?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
          { duration: 300 },
        );
    previousTotal = total;
    previousCount = count;
    focusControl(oldFocus);
  }
  window.addEventListener("coffee:change", render);
  render();
})();
