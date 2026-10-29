/* Coffee selection for the constructor. Existing draft/price rules stay in CoffeeShop. */
(() => {
  "use strict";
  const S = window.CoffeeShop;
  if (!S) return;
  const n = S.node;
  const normalized = (value) => value.normalize("NFKC").toLocaleLowerCase("uk").trim();

  function mount({ after, onChange }) {
    const heading = document.getElementById("mix-beans-title");
    heading.tabIndex = -1;
    const button = n("button", {
      type: "button",
      class: "button button-secondary mix-add-coffee",
      text: "+ Додати каву",
      "aria-haspopup": "dialog",
      "aria-controls": "mix-bean-dialog",
    });
    after.after(button);

    let filter = "all",
      pendingId = null,
      previousOverflow = "";
    const dialog = n("dialog", {
      id: "mix-bean-dialog",
      class: "bean-picker-dialog",
      "aria-labelledby": "bean-picker-title",
    });
    const closeButton = n("button", {
      type: "button",
      class: "bean-picker-close",
      text: "×",
      "aria-label": "Закрити вибір кави",
    });
    const search = n("input", {
      type: "search",
      id: "bean-picker-search",
      placeholder: "Назва сорту…",
      autocomplete: "off",
      spellcheck: "false",
    });
    const filters = [
      ["all", "Уся кава"],
      ["roasted", "Обсмажена"],
      ["green", "Зелене зерно"],
    ].map(([value, label]) => {
      const control = n("button", {
        type: "button",
        class: "bean-picker-filter",
        "data-bean-filter": value,
        "aria-pressed": String(value === filter),
        text: label,
      });
      control.addEventListener("click", () => {
        filter = value;
        paint();
      });
      return control;
    });
    const error = n("p", { class: "bean-picker-error", role: "alert", hidden: true });
    const resultStatus = n("p", {
      class: "visually-hidden",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    const counter = n("p", {
      id: "bean-picker-count",
      class: "bean-picker-count",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    const done = n("button", { type: "button", class: "button", text: "Готово" });
    const resetSearch = n("button", {
      type: "button",
      class: "button button-secondary",
      text: "Скинути пошук",
    });
    const empty = n(
      "div",
      { class: "bean-picker-empty", hidden: true },
      n("p", { text: "Каву не знайдено. Спробуйте іншу назву." }),
      resetSearch,
    );
    const list = n("ul", { class: "bean-picker-grid", role: "list", "aria-label": "Сорти кави" });
    const body = n("div", { class: "bean-picker-body" }, error, resultStatus, list, empty);

    const cards = S.products.map((product) => {
      const green = S.isGreen(product);
      const name = product.name.replace(/ · зелене зерно$/, "");
      const title = n("h3", { id: `bean-card-${product.id}`, tabindex: -1, text: name });
      const notes = (green ? product.notesByRoast?.medium || product.notes : product.notes).split(
        ".",
      )[0];
      const add = n("button", {
        type: "button",
        class: "button button-secondary bean-picker-add",
        "data-picker-add": product.id,
        text: "Додати",
        "aria-describedby": "bean-picker-count",
      });
      const element = n(
        "li",
        { class: "bean-picker-card", "data-bean-id": product.id },
        n("span", {
          class: `bean-picker-kind${green ? " bean-picker-kind-green" : ""}`,
          text: green ? "Зелене зерно" : `${S.roasts[product.roast]} обсмаження`,
        }),
        title,
        n("p", { class: "bean-picker-notes", text: notes }),
        n(
          "div",
          { class: "bean-picker-card-bottom" },
          n(
            "div",
            { class: "bean-picker-price" },
            n("strong", { text: S.money(S.productPrice(product, 250)) }),
            n("span", { text: "за 250 г" }),
          ),
          add,
        ),
      );
      add.addEventListener("click", async (event) => {
        if (pendingId || add.disabled) return;
        const keyboard = event.detail === 0;
        const hadFocus = document.activeElement === add;
        pendingId = product.id;
        error.hidden = true;
        paint();
        let persisted = false,
          storageFailed = false;
        try {
          const alreadySelected = S.get().draft.beans.some((bean) => bean.id === product.id);
          persisted = await S.addBean(product.id);
          const draft = S.get().draft;
          const inMix = draft.beans.some((bean) => bean.id === product.id);
          storageFailed = !persisted && inMix && !alreadySelected && !(await S.update(() => {}));
          if (storageFailed) {
            error.textContent =
              "Браузер не зберіг вибір. Він доступний лише на цій сторінці. Дозвольте збереження даних і повторіть спробу.";
            error.hidden = false;
          } else if (!inMix) {
            error.textContent =
              draft.beans.length >= 4
                ? "У міксі вже чотири сорти. Видаліть один із них у конструкторі, щоб додати інший."
                : "Не вдалося додати сорт. Спробуйте ще раз.";
            error.hidden = false;
          }
        } catch {
          error.textContent = "Не вдалося додати сорт. Спробуйте ще раз.";
          error.hidden = false;
        } finally {
          pendingId = null;
          paint();
          onChange({ persisted, storageFailed });
          if (
            dialog.open &&
            hadFocus &&
            [document.body, dialog, add].includes(document.activeElement)
          ) {
            if (keyboard) {
              const index = cards.findIndex((card) => card.product.id === product.id);
              const next = [...cards.slice(index + 1), ...cards.slice(0, index)].find(
                (card) => !card.element.hidden && !card.add.disabled,
              );
              (next?.add || done).focus();
            } else title.focus({ preventScroll: true });
          }
        }
      });
      return { product, green, title, element, add };
    });
    list.append(...cards.map((card) => card.element));
    dialog.append(
      n(
        "div",
        { class: "bean-picker-header" },
        n(
          "div",
          { class: "bean-picker-heading" },
          n("h2", { id: "bean-picker-title", text: "Додати каву до міксу" }),
          closeButton,
        ),
        n(
          "div",
          { class: "bean-picker-search" },
          n("label", { for: "bean-picker-search", text: "Пошук кави" }),
          search,
        ),
        n(
          "div",
          { class: "bean-picker-filters", role: "group", "aria-label": "Тип кави" },
          filters,
        ),
      ),
      body,
      n("div", { class: "bean-picker-footer" }, counter, done),
    );
    document.body.append(dialog);

    function paint() {
      const beans = S.get().draft.beans;
      const selected = new Set(beans.map((bean) => bean.id));
      const query = normalized(search.value);
      let found = 0;
      for (const card of cards) {
        const chosen = selected.has(card.product.id);
        const visible =
          (filter === "all" || (filter === "green") === card.green) &&
          normalized(card.product.name).includes(query);
        card.element.hidden = !visible;
        if (visible) found++;
        card.element.classList.toggle("is-selected", chosen);
        card.add.disabled = Boolean(pendingId) || chosen || beans.length >= 4;
        card.add.textContent =
          pendingId === card.product.id ? "Додаємо…" : chosen ? "✓ У міксі" : "Додати";
        card.add.setAttribute(
          "aria-label",
          chosen ? `${card.product.name} — уже у міксі` : `Додати ${card.product.name} до міксу`,
        );
        card.add.setAttribute("aria-busy", String(pendingId === card.product.id));
      }
      for (const control of filters)
        control.setAttribute("aria-pressed", String(control.dataset.beanFilter === filter));
      empty.hidden = found > 0;
      const countText = `Обрано ${beans.length} з 4`;
      if (counter.textContent !== countText) counter.textContent = countText;
      const resultsText = `Знайдено сортів: ${found}`;
      if (resultStatus.textContent !== resultsText) resultStatus.textContent = resultsText;
      button.hidden = beans.length >= 4;
    }
    function focusTrigger() {
      (button.hidden ? heading : button).focus({ preventScroll: true });
    }
    button.addEventListener("click", () => {
      if (dialog.open) return;
      search.value = "";
      filter = "all";
      error.hidden = true;
      paint();
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      dialog.showModal();
      body.scrollTop = 0;
      (matchMedia("(pointer: fine)").matches ? search : closeButton).focus({ preventScroll: true });
    });
    done.addEventListener("click", () => dialog.close());
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      document.documentElement.style.overflow = previousOverflow;
      focusTrigger();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((control) => control.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    search.addEventListener("input", paint);
    resetSearch.addEventListener("click", () => {
      search.value = "";
      filter = "all";
      paint();
      search.focus({ preventScroll: true });
    });
    window.addEventListener("coffee:change", paint);
    paint();
    return Object.freeze({ sync: paint, focusTrigger, button });
  }
  window.CoffeeBeanPicker = Object.freeze({ mount });
})();
