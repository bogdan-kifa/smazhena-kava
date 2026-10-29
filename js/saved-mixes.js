/* Presentation over the existing local list. New account/management operations stay deferred. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    n = S.node;
  const list = document.querySelector(".saved-mixes-grid");
  if (!list) return;
  const paths = {
    edit: "M14 4 20 10M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    link: "m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 1 1 6 6l-5 5a4 4 0 0 1-6 0",
    pin: "m8 3 9 0-1 7 3 4H5l3-4zM12 14v8",
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
  function futureButton(kind, label, name) {
    return n(
      "button",
      {
        class: "saved-icon-button saved-future-button",
        type: "button",
        disabled: true,
        title: `${label} — скоро`,
        "aria-label": `${label} мікс «${name}». Скоро — буде доступно пізніше.`,
      },
      icon(kind),
      n("span", { class: "saved-future-label", "aria-hidden": "true", text: "Скоро" }),
    );
  }
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
    const state = presentation.state || (amount === null ? "price-error" : "ready");
    const blocked = state !== "ready";
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
          const current = s.saved.find((item) => item.id === m.id);
          if (!current) return false;
          s.draft = current;
        });
        if (ok) location.href = S.url("constructor.html");
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
        const ok = await S.update((s) => {
          s.saved = s.saved.filter((item) => item.id !== m.id);
        });
        S.notify(ok ? "Мікс видалено." : "Не вдалося видалити мікс. Браузер не зберіг зміни.");
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
        n(
          "div",
          { class: "saved-mix-title-tools" },
          futureButton("rename", "Перейменувати", name),
          futureButton("pin", "Закріпити", name),
        ),
      ),
      bar,
      legend,
      chips,
      warning,
      priceRow,
      n(
        "div",
        { class: "saved-mix-actions" },
        repeat,
        edit,
        futureButton("link", "Скопіювати посилання на", name),
        remove,
      ),
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
  function render() {
    const active = document.activeElement,
      previous = [...list.querySelectorAll("[data-recipe-id]")],
      card = active?.closest("[data-recipe-id]");
    const focus = list.contains(active)
      ? {
          id: card?.dataset.recipeId,
          index: previous.indexOf(card),
          action: active?.dataset.recipeAction,
        }
      : null;
    const saved = S.get().saved,
      count = saved.length;
    list.replaceChildren(...saved.map((m, index) => n("li", {}, createCard(m, index))));
    empty.hidden = count > 0;
    list.hidden = !count;
    notice.hidden = !count;
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
  render();
})();
