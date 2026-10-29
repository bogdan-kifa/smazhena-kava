/* Shared slot identity for grain, proportions and roast controls. */
(() => {
  "use strict";
  const S = window.CoffeeShop;
  if (!S) return;
  const n = S.node;
  const letter = (slot) => String.fromCharCode(65 + slot);
  const shortName = (product) => product.name.replace(/ · зелене зерно$/, "");
  const badge = (slot) =>
    n("span", {
      class: "mix-ratio-swatch",
      "data-color": slot,
      "aria-hidden": "true",
      text: letter(slot),
    });
  function icon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({
      viewBox: "0 0 24 24",
      class: "mix-customizer-icon",
      "aria-hidden": "true",
      focusable: "false",
    }))
      svg.setAttribute(k, v);
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute(
      "d",
      kind === "lock"
        ? "M7 11V7a5 5 0 0 1 10 0v4M6 11h12v10H6zM12 15v3"
        : "M12 7v1m0 3v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    );
    svg.append(path);
    return svg;
  }
  function mountBeans({ options, mutate, render, focus }) {
    options.classList.add("mix-bean-slots");
    options.setAttribute("role", "list");
    options.setAttribute("aria-label", "Слоти кавового міксу");
    const pips = Array.from({ length: 4 }, () => n("span"));
    const countText = n("span");
    const count = n(
      "div",
      { class: "mix-bean-count", role: "status", "aria-live": "polite", "aria-atomic": "true" },
      n("span", { class: "mix-bean-pips", "aria-hidden": "true" }, pips),
      countText,
    );
    document
      .querySelector("#mix-beans-title")
      .closest(".mix-step-heading")
      .querySelector(".muted")
      .replaceWith(count);
    const warning = n("p", { class: "mix-bean-warning", role: "status", hidden: true });
    const error = n("p", { class: "mix-customizer-error", role: "alert", hidden: true });
    const limit = n(
      "p",
      { class: "mix-bean-limit", role: "status", hidden: true },
      icon("info"),
      n("span", { text: "Максимум чотири сорти. Приберіть один, щоб додати інший." }),
    );
    options.after(warning, error, limit);
    let pending = false;
    function clearError() {
      error.hidden = true;
    }
    async function remove(id) {
      if (pending) return;
      pending = true;
      error.hidden = true;
      options.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await mutate((draft) => {
          const index = draft.beans.findIndex((bean) => bean.id === id);
          if (index < 0) return;
          draft.beans.splice(index, 1);
        });
      } catch {
        error.textContent = "Не вдалося прибрати сорт. Спробуйте ще раз.";
        error.hidden = false;
      } finally {
        pending = false;
        render();
        focus();
      }
    }
    return Object.freeze({
      clearError,
      render(m) {
        options.hidden = false;
        options.replaceChildren(
          ...Array.from({ length: 4 }, (_, slot) => {
            const bean = m.beans.find((item) => item.slot === slot);
            const prefix = n("span", { class: "visually-hidden", text: `Слот ${letter(slot)}. ` });
            if (!bean)
              return n(
                "div",
                { class: "mix-bean-slot is-empty", "data-slot": slot, role: "listitem" },
                badge(slot),
                n("span", {}, prefix, "Вільний слот"),
              );
            const product = S.byId.get(bean.id);
            const button = n("button", {
              type: "button",
              class: "mix-bean-remove",
              "data-remove-bean": bean.id,
              "aria-label": `Прибрати сорт «${product.name}»`,
              text: "×",
              disabled: pending,
            });
            button.addEventListener("click", () => remove(bean.id));
            return n(
              "div",
              {
                class: "mix-bean-slot mix-bean-chip",
                "data-slot": slot,
                "data-bean-id": bean.id,
                role: "listitem",
              },
              badge(slot),
              n(
                "span",
                { class: "mix-bean-info" },
                prefix,
                n("span", { class: "mix-bean-name", text: shortName(product) }),
                n("span", {
                  class: "mix-bean-state",
                  text: S.isGreen(product) ? "Зелене зерно" : "Обсмажене",
                }),
              ),
              button,
            );
          }),
        );
        pips.forEach((pip, slot) =>
          pip.classList.toggle(
            "is-filled",
            m.beans.some((bean) => bean.slot === slot),
          ),
        );
        const text = `${m.beans.length} з 4 сортів`;
        if (countText.textContent !== text) countText.textContent = text;
        const families = new Map();
        for (const bean of m.beans) {
          const product = S.byId.get(bean.id),
            key = S.beanFamily(product);
          if (!families.has(key)) families.set(key, []);
          families.get(key).push(product);
        }
        const duplicate = [...families.values()].filter(
          (products) => new Set(products.map((p) => S.isGreen(p))).size > 1,
        );
        warning.hidden = !duplicate.length;
        const duplicateText = duplicate
          .map(
            (products) =>
              `«${shortName(products[0])}» додано обсмаженим і зеленим. Це можливо, але перевірте, що так і задумано.`,
          )
          .join(" ");
        if (warning.textContent !== duplicateText) warning.textContent = duplicateText;
        limit.hidden = m.beans.length < 4;
      },
    });
  }
  function mountRoast({ element, mutate }) {
    const description = n(
      "p",
      { class: "mix-roast-description muted", hidden: true },
      "Для зеленого зерна оберіть обсмаження — воно включене у вартість.",
      n("br"),
      "Для готового зерна профіль уже заданий.",
    );
    const greenList = n("div", { class: "mix-roast-green-list" }),
      fixedList = n("div", { class: "mix-roast-fixed-list" });
    const greenGroup = n(
      "section",
      { class: "mix-roast-group", "aria-labelledby": "mix-roast-green-title", hidden: true },
      n(
        "div",
        { class: "mix-roast-group-heading" },
        n("h3", { id: "mix-roast-green-title", text: "Потрібен ваш вибір" }),
      ),
      greenList,
    );
    const fixedGroup = n(
      "section",
      {
        class: "mix-roast-group mix-roast-readonly",
        "aria-labelledby": "mix-roast-fixed-title",
        hidden: true,
      },
      n("h3", { id: "mix-roast-fixed-title", text: "Уже обсмажене" }),
      fixedList,
    );
    const error = n("p", { class: "mix-customizer-error", role: "alert", hidden: true });
    element.replaceChildren(
      n(
        "div",
        { class: "mix-step-heading" },
        n(
          "h2",
          { id: "mix-roast-title", class: "mix-step-title" },
          n("span", { class: "mix-step-number", "aria-hidden": "true", text: "4" }),
          "Обсмаження",
        ),
      ),
      description,
      error,
      greenGroup,
      fixedGroup,
    );
    let signature = "",
      rows = new Map(),
      sequence = 0;
    const requested = new Map();
    const hints = {
      light: {
        text: "Виразніша кислотність і легка гіркота",
        chips: ["кислотність ↑", "гіркота ↓"],
      },
      medium: { text: "Виразніша солодкість і м’якша кислотність", chips: ["баланс"] },
      dark: {
        text: "Стриманіша кислотність і насиченіша гіркота",
        chips: ["гіркота ↑", "кислотність ↓"],
      },
    };
    const dot = (roast) =>
      n("span", { class: "mix-roast-dot", "data-roast-level": roast, "aria-hidden": "true" });
    function sync(m) {
      const current = m.beans.map((bean) => ({
        bean,
        product: S.byId.get(bean.id),
        state: S.isGreen(S.byId.get(bean.id)) ? "green" : "roasted",
      }));
      description.hidden = !current.length;
      const green = current.filter((item) => item.state === "green");
      for (const item of green) {
        const row = rows.get(item.bean.id);
        if (!row) continue;
        const value = requested.get(item.bean.id)?.value || S.beanRoast(item.bean);
        row.inputs.forEach((input) => {
          input.checked = input.value === value;
        });
        const hint = hints[value];
        row.text.textContent = hint.text;
        row.chips.replaceChildren(
          ...hint.chips.map((text) => n("span", { class: "mix-roast-hint-chip", text })),
        );
        row.fieldset.setAttribute("aria-busy", String(requested.has(item.bean.id)));
      }
    }
    async function change(changes) {
      const token = ++sequence;
      error.hidden = true;
      for (const { id, roast } of changes) requested.set(id, { value: roast, token });
      sync(S.get().draft);
      try {
        const ok = await mutate((draft) => {
          for (const { id, roast } of changes) {
            const bean = draft.beans.find((item) => item.id === id);
            if (bean && S.isGreen(S.byId.get(id)) && Object.hasOwn(S.roasts, roast))
              bean.roast = roast;
          }
        });
        if (!ok) {
          error.textContent =
            "Браузер не зберіг зміни обсмаження. Вони доступні лише на цій сторінці.";
          error.hidden = false;
        }
      } catch {
        error.textContent = "Не вдалося змінити обсмаження. Спробуйте ще раз.";
        error.hidden = false;
      } finally {
        for (const { id } of changes) if (requested.get(id)?.token === token) requested.delete(id);
        sync(S.get().draft);
      }
    }
    return Object.freeze({
      render(m) {
        const next = JSON.stringify(m.beans.map((bean) => [bean.id, bean.slot]));
        if (next === signature) {
          sync(m);
          return;
        }
        signature = next;
        rows = new Map();
        const data = m.beans.map((bean) => ({
          bean,
          product: S.byId.get(bean.id),
          state: S.isGreen(S.byId.get(bean.id)) ? "green" : "roasted",
        }));
        const green = data.filter((item) => item.state === "green"),
          fixed = data.filter((item) => item.state === "roasted");
        greenGroup.hidden = !green.length;
        fixedGroup.hidden = !fixed.length;
        greenList.replaceChildren(
          ...green.map(({ bean, product }) => {
            const text = n("span"),
              chips = n("span", { class: "mix-roast-hint-chips" });
            const hintId = `roast-hint-${bean.id}`;
            const inputs = Object.entries(S.roasts).map(([value, label]) => {
              const id = `roast-${bean.id}-${value}`;
              const input = n("input", {
                type: "radio",
                class: "visually-hidden mix-roast-radio",
                name: `roast-${bean.id}`,
                id,
                value,
                "aria-describedby": hintId,
              });
              input.addEventListener("change", () => {
                if (input.checked) change([{ id: bean.id, roast: value }]);
              });
              return {
                input,
                label: n("label", { class: "mix-roast-choice", for: id }, dot(value), label),
              };
            });
            const fieldset = n(
              "fieldset",
              { class: "mix-roast-control" },
              n("legend", {
                class: "visually-hidden",
                text: `Обсмаження: ${product.name}, слот ${letter(bean.slot)}`,
              }),
              n(
                "div",
                { class: "mix-roast-segments" },
                inputs.flatMap((item) => [item.input, item.label]),
              ),
            );
            rows.set(bean.id, { inputs: inputs.map((item) => item.input), fieldset, text, chips });
            return n(
              "div",
              { class: "mix-roast-entry", "data-roast-bean": bean.id },
              n(
                "div",
                { class: "mix-roast-control-row" },
                n(
                  "div",
                  { class: "mix-roast-identity" },
                  badge(bean.slot),
                  n(
                    "div",
                    {},
                    n("span", { class: "mix-roast-name", text: shortName(product) }),
                    n("span", { class: "mix-roast-meta", text: "Зелене зерно" }),
                  ),
                ),
                fieldset,
              ),
              n("div", { class: "mix-roast-hint", id: hintId }, icon("info"), text, chips),
            );
          }),
        );
        fixedList.replaceChildren(
          ...fixed.map(({ bean, product }) =>
            n(
              "div",
              { class: "mix-roast-locked-row", "data-roast-bean": bean.id },
              n(
                "div",
                { class: "mix-roast-identity" },
                badge(bean.slot),
                n("span", { class: "mix-roast-name", text: product.name }),
              ),
              n(
                "span",
                { class: "mix-roast-locked-value" },
                icon("lock"),
                dot(product.roast),
                `${S.roasts[product.roast]} · задано`,
              ),
            ),
          ),
        );
        sync(m);
      },
    });
  }
  window.CoffeeMixCustomizer = Object.freeze({ mountBeans, mountRoast });
})();
