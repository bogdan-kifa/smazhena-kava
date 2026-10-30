/* Saved recipes belong to the authenticated account and are loaded from the API. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    n = S.node;
  const list = document.querySelector(".saved-mixes-grid");
  if (!list) return;
  const paths = {
    edit: "M14 4 20 10M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    rename: "M4 7V3h16v4M12 3v18m-4 0h8",
    info: "M12 8h.1M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    warning: "M12 3 1 21h22zM12 9v5m0 3h.1",
    bag: "M5 7h14l2 15H3zM8 7V5a4 4 0 0 1 8 0v2",
    cup: "M3 7h14v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM17 8h2a3 3 0 0 1 0 6h-2M6 2v2m4-3v3m4-2v2",
    weight: "M5 7h14l3 15H2zM9 7V5a3 3 0 0 1 6 0v2",
  };
  function icon(kind, className = "saved-icon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      class: className,
    }))
      svg.setAttribute(key, value);
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[kind] || paths.info);
    svg.append(path);
    return svg;
  }
  const noun = (count) =>
    count % 100 >= 11 && count % 100 <= 14
      ? "міксів"
      : count % 10 === 1
        ? "мікс"
        : count % 10 >= 2 && count % 10 <= 4
          ? "мікси"
          : "міксів";
  const letter = (slot) => String.fromCharCode(65 + slot);
  function date(m) {
    const updated = m.updatedAt && m.updatedAt !== m.createdAt,
      value = updated ? m.updatedAt : m.createdAt;
    if (!value || !Number.isFinite(Date.parse(value)))
      return n("p", { class: "saved-mix-date", text: "Дата збереження невідома" });
    return n(
      "p",
      { class: "saved-mix-date" },
      updated ? "Оновлено " : "Збережено ",
      n("time", {
        datetime: value,
        title: new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeStyle: "short" }).format(
          new Date(value),
        ),
        text: new Intl.DateTimeFormat("uk-UA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(value)),
      }),
    );
  }
  function createCard(m, index = 0, presentation = {}) {
    const name = m.name || "Мій мікс",
      titleId = `saved-mix-${index}-title`;
    const beans = Array.isArray(m.beans) ? m.beans : [];
    let amount = null;
    try {
      const value = S.mixPrice(m);
      if (Number.isFinite(value) && value >= 0) amount = value;
    } catch {
      /* An error view never displays a fabricated price. */
    }
    const state = presentation.state || (beans.some((b) => !S.available(S.byId.get(b.id))) ? "unavailable" : amount === null ? "price-error" : "ready");
    const blocked = state !== "ready";
    const renameId = `saved-rename-${index}`;
    const rename = n(
      "button",
      {
        class: "saved-icon-button mo-saved-rename-toggle",
        type: "button",
        "data-recipe-action": "rename",
        title: "Перейменувати мікс",
        "aria-label": `Перейменувати мікс «${name}»`,
        "aria-expanded": "false",
        "aria-controls": renameId,
      },
      icon("rename"),
    );
    const renameForm = n("form", {
      id: renameId,
      class: "saved-rename-form mo-saved-rename",
      hidden: true,
      novalidate: "",
      "aria-label": `Перейменування міксу «${name}»`,
    });
    const input = n("input", {
      id: renameId + "-input",
      name: "mix-name",
      type: "text",
      value: name,
      maxlength: 60,
      required: "",
      autocomplete: "off",
      "aria-describedby": renameId + "-error",
    });
    const error = n("p", {
      id: renameId + "-error",
      class: "mo-saved-rename-error",
      role: "alert",
      hidden: true,
    });
    const save = n("button", { type: "submit", class: "button", text: "Зберегти назву" });
    const cancel = n("button", {
      type: "button",
      class: "button button-secondary",
      text: "Скасувати",
    });
    renameForm.append(
      n("label", { for: input.id, text: "Нова назва міксу" }),
      input,
      error,
      n("div", { class: "mo-saved-rename-actions" }, save, cancel),
    );
    let pending = false;
    function closeRename() {
      if (pending) return;
      renameForm.hidden = true;
      rename.setAttribute("aria-expanded", "false");
      rename.focus();
    }
    rename.addEventListener("click", () => {
      if (pending) return;
      if (!renameForm.hidden) return closeRename();
      renameForm.hidden = false;
      rename.setAttribute("aria-expanded", "true");
      input.value = name;
      error.hidden = true;
      input.removeAttribute("aria-invalid");
      input.focus();
      input.select();
    });
    cancel.addEventListener("click", closeRename);
    renameForm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRename();
      }
    });
    input.addEventListener("input", () => {
      error.hidden = true;
      input.removeAttribute("aria-invalid");
    });
    async function updateMix(body) {
      if (pending) return;
      pending = true;
      article.setAttribute("aria-busy", "true");
      const controls = [...article.querySelectorAll("button,input")].map((control) => [
        control,
        control.disabled,
      ]);
      controls.forEach(([control]) => (control.disabled = true));
      try {
        await CoffeeAPI.request("mixes/" + encodeURIComponent(m.id), { method: "PATCH", body });
        await render({ id: m.id, action: "rename" });
        S.notify("Назву міксу збережено.");
      } catch (e) {
        error.textContent = e.message || "Не вдалося змінити назву.";
        error.hidden = false;
      } finally {
        pending = false;
        article.removeAttribute("aria-busy");
        controls.forEach(([control, disabled]) => (control.disabled = disabled));
        if (article.isConnected) {
          input.focus();
        }
      }
    }
    renameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending) return;
      const value = input.value.trim().replace(/\s+/g, " ");
      if (!value || value.length > 60) {
        error.textContent = "Введіть назву від 1 до 60 символів.";
        error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      if (value === name) return closeRename();
      updateMix({ name: value });
    });
    const edit = n(
      "button",
      {
        class: "saved-icon-button saved-mix-edit",
        type: "button",
        "data-recipe-action": "edit",
        "aria-label": `Редагувати мікс «${name}»`,
        title: "Редагувати склад",
      },
      icon("edit"),
    );
    edit.addEventListener("click", async () => {
      if (edit.disabled) return;
      edit.disabled = true;
      try {
        const ok = await S.update((s) => {
          s.draft = S.mix(m);
        });
        if (ok) location.href = S.url("constructor.html?editSaved=" + encodeURIComponent(m.id));
        else S.notify("Не вдалося відкрити мікс. Перевірте дозвіл браузера на збереження даних.");
      } catch {
        S.notify("Не вдалося відкрити мікс. Спробуйте ще раз.");
      } finally {
        edit.disabled = false;
      }
    });
    const repeat = n("button", {
      class: "button saved-mix-repeat",
      type: "button",
      "data-recipe-action": "repeat",
      disabled: blocked,
      "aria-label": `Повторити мікс «${name}»`,
      text: "Повторити",
    });
    repeat.addEventListener("click", async () => {
      if (repeat.disabled) return;
      repeat.disabled = true;
      repeat.setAttribute("aria-busy", "true");
      try {
        await S.addMix(m);
      } catch {
        S.notify("Не вдалося додати мікс у кошик. Спробуйте ще раз.");
      } finally {
        repeat.disabled = blocked;
        repeat.removeAttribute("aria-busy");
      }
    });
    const remove = n(
      "button",
      {
        class: "saved-icon-button saved-mix-remove",
        type: "button",
        "data-recipe-action": "remove",
        "aria-label": `Видалити мікс «${name}»`,
        title: "Видалити мікс",
      },
      icon("trash"),
    );
    remove.addEventListener("click", async () => {
      if (remove.getAttribute("aria-busy") === "true") return;
      remove.setAttribute("aria-busy", "true");
      try {
        await CoffeeAPI.request("mixes/" + encodeURIComponent(m.id), {
          method: "DELETE",
          body: {},
        });
        S.notify("Мікс видалено.");
        await render();
      } catch {
        S.notify("Не вдалося видалити мікс. Спробуйте ще раз.");
      } finally {
        remove.removeAttribute("aria-busy");
      }
    });
    const bar = n("div", { class: "saved-composition-bar", "aria-hidden": "true" });
    const legend = n("ul", {
      class: "saved-composition-legend",
      "aria-label": `Склад міксу «${name}»`,
    });
    beans.forEach((bean, i) => {
      const slot = Number.isInteger(bean.slot) && bean.slot >= 0 && bean.slot < 4 ? bean.slot : i;
      const product = S.byId.get(bean.id),
        ratio = Number.isFinite(bean.ratio) ? Math.max(0, Math.min(100, bean.ratio)) : 0;
      bar.append(
        n("span", {
          "data-color": slot,
          style: `flex-basis:${ratio}%`,
          text: ratio >= 15 ? `${ratio}%` : "",
        }),
      );
      legend.append(
        n(
          "li",
          {},
          n("span", {
            class: "saved-composition-letter",
            "data-color": slot,
            "aria-hidden": "true",
            text: letter(slot),
          }),
          n("span", {
            class: "saved-bean-name",
            text: product?.name || "Сорт відсутній у каталозі",
          }),
          n("strong", { text: `${ratio}%` }),
        ),
      );
    });
    const packaging = S.packaging[m.packaging] || S.packaging["1"];
    const chips = n(
      "ul",
      { class: "saved-mix-chips", "aria-label": "Налаштування міксу" },
      n("li", {}, icon("weight"), n("span", { text: `${m.weight} г` })),
      n("li", {}, icon("cup"), n("span", { text: S.grinds[m.grind] || "Помел не задано" })),
      n(
        "li",
        {},
        icon("bag"),
        n("span", {
          text: packaging.name + (packaging.price ? ` (+${S.money(packaging.price)})` : ""),
        }),
      ),
    );
    const warning = n(
      "div",
      { class: `saved-mix-warning${state === "price-error" ? " is-error" : ""}`, hidden: !blocked },
      icon("warning"),
      n("p", {
        text:
          presentation.reason ||
          (state === "unavailable"
            ? "Один із сортів тимчасово недоступний. Відредагуйте склад, щоб замінити його."
            : state === "price-changed"
              ? "Ціна змінилася. Перевірте мікс у конструкторі."
              : "Не вдалося визначити ціну. Перевірте склад у конструкторі."),
      }),
    );
    const priceRow = n(
      "div",
      { class: "saved-mix-price-row" },
      n("strong", {
        class: "saved-mix-price",
        text: amount === null || state === "price-error" ? "Ціна недоступна" : S.money(amount),
      }),
    );
    // Actual order counts will come from the future order-history source.
    if (Number.isInteger(presentation.orderCount) && presentation.orderCount >= 0)
      priceRow.append(
        n("span", { class: "saved-order-count", text: `Замовлень: ${presentation.orderCount}` }),
      );
    const article = n(
      "article",
      {
        class: "card saved-mix-card",
        "data-recipe-id": m.id,
        "data-view-state": state,
        "aria-labelledby": titleId,
      },
      n(
        "header",
        { class: "saved-mix-header" },
        n(
          "div",
          { class: "saved-mix-heading-copy" },
          n("h2", { id: titleId, text: name }),
          date(m),
        ),
        n("div", { class: "saved-mix-title-tools" }, rename),
      ),
      renameForm,
      bar,
      legend,
      chips,
      warning,
      priceRow,
      n("div", { class: "saved-mix-actions" }, repeat, edit, remove),
    );
    if (blocked) {
      const hintId = `saved-mix-${index}-warning`;
      warning.id = hintId;
      repeat.setAttribute("aria-describedby", hintId);
    }
    return article;
  }
  const empty = document.getElementById("saved-mixes-empty"),
    notice = document.getElementById("saved-local-notice"),
    toolbar = document.getElementById("saved-mixes-toolbar"),
    sort = document.getElementById("saved-sort-field");
  let generation = 0;
  async function render(preferredFocus = null) {
    const run = ++generation;
    const status = document.getElementById("saved-account-status");
    let saved;
    try {
      const user = await CoffeeAPI.getUser();
      if (run !== generation) return;
      if (!user) {
        list.replaceChildren();
        list.hidden = true;
        empty.hidden = true;
        toolbar.hidden = true;
        status.replaceChildren(
          n("p", { text: "Увійдіть, щоб переглянути збережені мікси." }),
          n("a", {
            class: "button",
            href: S.url("login.html?next=my-mixes.html"),
            text: (window.CoffeeSite?.demo ? "Відкрити демопрофіль" : "Увійти або зареєструватися"),
          }),
        );
        return;
      }
      saved = (await CoffeeAPI.request("mixes")).mixes;
      if (run !== generation) return;
      status.replaceChildren();
    } catch (error) {
      if (run !== generation) return;
      status.textContent = error.message;
      list.hidden = true;
      empty.hidden = true;
      return;
    }
    const active = document.activeElement,
      previous = [...list.querySelectorAll("[data-recipe-id]")],
      card = active?.closest("[data-recipe-id]");
    const focus = preferredFocus?.id
      ? preferredFocus
      : list.contains(active)
        ? {
            id: card?.dataset.recipeId,
            index: previous.indexOf(card),
            action: active?.dataset.recipeAction,
          }
        : null;
    const count = saved.length;
    const order = document.getElementById("saved-sort").value;
    if (order === "price") saved.sort((a, b) => S.mixPrice(a) - S.mixPrice(b));
    if (order === "name") saved.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    list.replaceChildren(...saved.map((m, index) => n("li", {}, createCard(m, index))));
    empty.hidden = count > 0;
    list.hidden = !count;
    notice.hidden = true;
    toolbar.hidden = !count;
    sort.hidden = count < 2;
    document.getElementById("saved-tab-count").textContent = String(count);
    document.getElementById("saved-count-label").textContent = `${count} ${noun(count)}`;
    if (focus) {
      const cards = [...list.querySelectorAll("[data-recipe-id]")],
        next =
          cards.find((item) => item.dataset.recipeId === focus.id) ||
          cards[Math.min(Math.max(focus.index, 0), cards.length - 1)];
      (
        next?.querySelector(`[data-recipe-action="${focus.action}"]`) ||
        next?.querySelector("button:not(:disabled)") ||
        empty.querySelector("a")
      )?.focus({ preventScroll: true });
    }
  }
  window.CoffeeSavedMixes = Object.freeze({ createCard, noun });
  window.addEventListener("coffee:change", (event) => {
    if (!event.detail?.changed || event.detail.changed.includes("saved")) render();
  });
  document.getElementById("saved-sort").addEventListener("change", render);
  addEventListener("pageshow", (event) => {
    if (event.persisted) render();
  });
  render();
})();
