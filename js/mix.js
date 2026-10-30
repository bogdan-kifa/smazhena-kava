(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S;
  const form = document.getElementById("mix-form");
  if (!form) return;
  form.querySelector(".mix-settings").disabled = false;
  form.addEventListener("submit", (e) => e.preventDefault());
  const status = document.getElementById("mix-form-status");
  status.textContent =
    "До чотирьох сортів. Налаштуйте частки кожного сорту окремо, щоб у сумі було рівно 100%. Тоді можна зберегти мікс або додати його до кошика.";
  status.classList.add("visually-hidden");
  const options = form.querySelector(".mix-options");
  const beanPicker = window.CoffeeBeanPicker.mount({
    after: options,
    onChange: ({ persisted, storageFailed }) => {
      beanSlots.clearError();
      if (storageFailed) persistence(false);
      else if (persisted) persistence(true);
      renderFields();
    },
  });
  const beanSlots = window.CoffeeMixCustomizer.mountBeans({
    options,
    mutate: (change) => setDraft(change),
    render: () => renderFields(),
    focus: () => beanPicker.focusTrigger(),
  });
  const roastUI = window.CoffeeMixCustomizer.mountRoast({
    element: form.querySelector('[aria-labelledby="mix-roast-title"]'),
    mutate: (change) => setDraft(change),
  });
  const mixProfile = window.CoffeeMixProfile.mount(
    document.getElementById("mix-profile-title").parentElement,
  );
  const buttons = document.querySelectorAll(".mix-summary-actions button");
  buttons.forEach((b) => (b.disabled = false));
  const [cartButton, saveButton, resetButton] = buttons;
  const editCartKey = new URLSearchParams(location.search).get("editCart");
  const editingLine =
    editCartKey &&
    S.get().cart.find((item) => item.type === "mix" && S.lineKey(item) === editCartKey);
  const editingSnapshot = editingLine ? JSON.stringify(editingLine.mix) : null;
  if (editCartKey) cartButton.textContent = "Зберегти зміни в кошику";
  const actionStatus = n("p", {
    id: "mix-action-status",
    class: "mix-action-status",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
    hidden: true,
  });
  const persistenceStatus = n("p", {
    id: "mix-persistence-status",
    class: "mix-action-status",
    role: "status",
    hidden: true,
  });
  document.querySelector(".mix-summary-actions").prepend(actionStatus, persistenceStatus);
  for (const button of [cartButton, saveButton])
    button.setAttribute(
      "aria-describedby",
      `${button.getAttribute("aria-describedby") || ""} mix-action-status mix-persistence-status`.trim(),
    );
  let draftWrites = 0;
  function persistence(ok) {
    persistenceStatus.hidden = ok;
    persistenceStatus.textContent = ok
      ? ""
      : "Браузер не зберіг зміни. Вони доступні лише на цій сторінці. Дозвольте сховище перед переходом або збереженням рецепта.";
    persistenceStatus.dataset.invalid = String(!ok);
  }
  const totalBadge = document.getElementById("mix-total-status");
  const ratioSection = document.getElementById("mix-proportions-title").closest("section");
  const ratioRows = ratioSection.querySelector(".mix-ratios");
  ratioSection.classList.add("mix-proportions-enhanced");
  const ratioControls = new Map();
  const ratioColors = new Map();
  const composition = n("div", {
    class: "mix-composition",
    role: "group",
    "aria-label": "Склад міксу",
  });
  const compositionEmpty = n("span", {
    class: "mix-composition-empty",
    "aria-hidden": "true",
    text: "Оберіть частки сортів",
  });
  composition.append(compositionEmpty);
  ratioRows.before(n("div", { class: "mix-ratio-overview" }, composition));
  const equalizeButton = n("button", {
    type: "button",
    class: "button button-secondary mix-equalize",
    text: "Поділити порівну",
  });
  ratioRows.after(n("div", { class: "mix-ratio-footer" }, equalizeButton));
  equalizeButton.addEventListener("click", async () => {
    await editRatios((draft) => {
      if (!draft.beans.length) return;
      const share = Math.floor(100 / draft.beans.length),
        remainder = 100 % draft.beans.length;
      draft.beans.forEach((bean, index) => {
        bean.ratio = share + (index < remainder ? 1 : 0);
      });
    });
  });
  const setDraft = async (fn) => {
    draftWrites++;
    summary();
    try {
      const ok = await S.update((s) => fn(s.draft));
      persistence(ok);
      return ok;
    } finally {
      draftWrites--;
      summary();
    }
  };
  const scheduledRatios = new Map();
  form.querySelectorAll('[name="weight"],[name="grind"],[name="packaging"]').forEach((input) =>
    input.addEventListener("change", async () => {
      if (input.checked)
        await setDraft(
          (m) => (m[input.name] = input.name === "weight" ? Number(input.value) : input.value),
        );
      summary();
    }),
  );
  function summary() {
    const m = S.get().draft,
      ready = S.validMix(m),
      total = ready ? S.mixPrice(m) : 0,
      percentage = m.beans.reduce((sum, bean) => sum + bean.ratio, 0);
    updateRatioTools(m);
    mixProfile.update(m, ready, S.mixTaste(m));
    const pair = (key, value) => n("div", {}, n("dt", { text: key }), n("dd", {}, value));
    const lists = document.querySelectorAll(".mix-summary-list");
    lists[0].replaceChildren(...m.beans.map((b) => pair(S.byId.get(b.id).name, `${b.ratio}%`)));
    if (!m.beans.length) lists[0].append(pair("Склад", "Оберіть зерна з каталогу"));
    const packagingRow = pair(
      "Пакування",
      S.packaging[m.packaging].price ? S.packagingText(m) : S.packaging[m.packaging].name,
    );
    packagingRow.className = "mix-summary-packaging";
    lists[1].replaceChildren(
      pair("Вага", `${m.weight} г`),
      pair("Помел", S.grinds[m.grind]),
      packagingRow,
    );
    document.querySelector(".mix-price").textContent = ready ? S.money(total) : "—";
    document.querySelector(".mix-delivery-row span:last-child").textContent = !ready
      ? "Встановіть 100%"
      : total >= 80000
        ? "Доступна"
        : S.money(80000 - total);
    const deliveryProgress = document.querySelector(".mix-delivery-progress");
    deliveryProgress.value = Math.min(800, total / 100);
    deliveryProgress.textContent = `${S.money(Math.min(80000, total))} з ${S.money(80000)}`;
    const totalText = !m.beans.length
      ? "0% · додайте зерна"
      : ready
        ? "100% · готово"
        : percentage < 100
          ? `${percentage}% · додайте ${100 - percentage}%`
          : `${percentage}% · зменште на ${percentage - 100}%`;
    totalBadge.textContent = totalText;
    totalBadge.dataset.invalid = String(!ready);
    const needsShares = m.beans.length > 0 && !ready;
    actionStatus.hidden = !needsShares;
    actionStatus.textContent = needsShares
      ? `Сума часток — ${percentage}%. ${percentage < 100 ? `Додайте ще ${100 - percentage}%` : `Зменште частки на ${percentage - 100}%`}.`
      : "";
    actionStatus.dataset.invalid = String(needsShares);
    saveButton.disabled = !ready || draftWrites > 0;
    cartButton.disabled = saveButton.disabled || m.beans.some((b) => b.ratio > 0 && !S.available(S.byId.get(b.id)));
    if (ready && cartButton.disabled && !draftWrites) { actionStatus.hidden = false; actionStatus.textContent = "Один із сортів недоступний. Замініть його перед замовленням."; }
    cartButton.setAttribute("aria-busy", String(draftWrites > 0));
    saveButton.setAttribute("aria-busy", String(draftWrites > 0));
  }
  async function ratio(id, value) {
    if (!S.get().draft.beans.some((b) => b.id === id)) return;
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      S.notify("Вкажіть ціле число від 0 до 100.");
      syncRatioInputs(id);
      return;
    }
    const scheduled = scheduledRatios.get(id);
    if (scheduled?.value === value) return scheduled.promise;
    const current = S.get().draft.beans.find((bean) => bean.id === id);
    if (!scheduled && current?.ratio === value) return true;
    const request = { value };
    scheduledRatios.set(id, request);
    request.promise = setDraft((m) => {
      const target = m.beans.find((bean) => bean.id === id);
      if (target) target.ratio = value;
    });
    try {
      await request.promise;
    } finally {
      if (scheduledRatios.get(id) === request) scheduledRatios.delete(id);
    }
    const target = S.get().draft.beans.find((bean) => bean.id === id);
    if (!target) return;
    const slider = document.getElementById(`ratio-${id}`),
      number = document.getElementById(`percent-${id}`);
    if (!slider || !number) return;
    slider.value = number.value = target.ratio;
    slider.setAttribute("aria-valuetext", `${target.ratio} відсотків`);
    slider.closest(".mix-ratio-row").style.setProperty("--mix-ratio", `${target.ratio}%`);
    summary();
  }
  function syncRatioInputs(id = null) {
    const beans = S.get().draft.beans;
    if (beans.length !== ratioControls.size || beans.some((bean) => !ratioControls.has(bean.id))) {
      const activeId = document.activeElement?.id;
      renderFields();
      const target = document.getElementById(activeId);
      if (target) target.focus({ preventScroll: true });
      else beanPicker.focusTrigger();
      return;
    }
    for (const bean of beans) {
      if (id && bean.id !== id) continue;
      const slider = document.getElementById(`ratio-${bean.id}`),
        number = document.getElementById(`percent-${bean.id}`);
      if (!slider || !number) continue;
      slider.value = number.value = bean.ratio;
      slider.setAttribute("aria-valuetext", `${bean.ratio} відсотків`);
      slider.closest(".mix-ratio-row").style.setProperty("--mix-ratio", `${bean.ratio}%`);
    }
  }
  async function editRatios(change) {
    const ok = await setDraft(change);
    syncRatioInputs();
    return ok;
  }
  async function balanceRatio(id) {
    let message = "";
    await editRatios((draft) => {
      const bean = draft.beans.find((entry) => entry.id === id);
      if (!bean) return;
      const remaining =
        100 - draft.beans.reduce((sum, entry) => sum + (entry.id === id ? 0 : entry.ratio), 0);
      if (remaining < 0 || remaining > 100) {
        message = "Інші сорти вже перевищують 100%. Спочатку зменште їхні частки.";
        return;
      }
      bean.ratio = remaining;
    });
    if (message) S.notify(message);
  }
  function updateRatioTools(m) {
    const total = m.beans.reduce((sum, bean) => sum + bean.ratio, 0);
    const visible = m.beans.filter((bean) => bean.ratio > 0);
    const gaps = Math.max(0, visible.length - 1) * 4;
    composition.parentElement.hidden = !m.beans.length;
    compositionEmpty.hidden = visible.length > 0;
    composition.setAttribute(
      "aria-label",
      `Склад міксу: ${m.beans.map((bean) => `${S.byId.get(bean.id).name} ${bean.ratio}%`).join(", ") || "сортів ще немає"}. Сума ${total}%.`,
    );
    equalizeButton.disabled = !m.beans.length;
    equalizeButton.parentElement.hidden = !m.beans.length;
    for (const bean of m.beans) {
      const controls = ratioControls.get(bean.id);
      if (!controls) continue;
      const remaining = 100 - (total - bean.ratio);
      controls.minus.disabled = bean.ratio === 0;
      controls.plus.disabled = bean.ratio === 100;
      controls.balance.disabled = remaining < 0 || remaining > 100 || remaining === bean.ratio;
      const balanceText = total > 100 ? "Зняти надлишок" : "Залишок сюди";
      controls.balance.textContent = balanceText;
      controls.balance.setAttribute(
        "aria-label",
        `${balanceText}: ${S.byId.get(bean.id).name}. Довести суму до 100%`,
      );
      controls.segment.hidden = bean.ratio === 0;
      const share = bean.ratio / Math.max(100, total);
      controls.segment.style.width = `calc(${share * 100}% - ${share * gaps}px)`;
      controls.segment.textContent = bean.ratio >= 10 ? `${bean.ratio}%` : "";
      controls.segment.setAttribute(
        "aria-label",
        `${S.byId.get(bean.id).name}: ${bean.ratio}%. Налаштувати частку`,
      );
      controls.segment.classList.toggle("mix-composition-first", visible[0]?.id === bean.id);
      controls.segment.classList.toggle(
        "mix-composition-last",
        visible[visible.length - 1]?.id === bean.id,
      );
    }
  }
  function renderFields() {
    const m = S.get().draft;
    beanSlots.render(m);
    const rows = ratioRows;
    rows.replaceChildren();
    ratioControls.clear();
    composition.replaceChildren(compositionEmpty);
    ratioColors.clear();
    for (const bean of m.beans) ratioColors.set(bean.id, bean.slot);
    m.beans.forEach((b) => {
      const p = S.byId.get(b.id),
        slider = n("input", {
          class: "mix-ratio-slider",
          id: `ratio-${b.id}`,
          type: "range",
          min: 0,
          max: 100,
          step: 1,
          value: b.ratio,
          "aria-valuetext": `${b.ratio} відсотків`,
          "aria-describedby": "mix-total-status",
        }),
        number = n("input", {
          id: `percent-${b.id}`,
          type: "number",
          min: 0,
          max: 100,
          step: 1,
          value: b.ratio,
          "aria-describedby": "mix-total-status",
          "aria-label": `Частка кави ${p.name}, відсотків`,
        });
      slider.addEventListener("input", () => ratio(b.id, Number(slider.value)));
      number.addEventListener("input", () => {
        const value = number.valueAsNumber;
        if (Number.isInteger(value) && value >= 0 && value <= 100) ratio(b.id, value);
      });
      number.addEventListener("change", () => ratio(b.id, number.valueAsNumber));
      const minus = n("button", {
        id: `ratio-minus-${b.id}`,
        type: "button",
        class: "mix-ratio-step",
        text: "−",
        "aria-label": `Зменшити частку ${p.name} на 1%`,
        "data-ratio-step": "minus",
      });
      const plus = n("button", {
        id: `ratio-plus-${b.id}`,
        type: "button",
        class: "mix-ratio-step",
        text: "+",
        "aria-label": `Збільшити частку ${p.name} на 1%`,
        "data-ratio-step": "plus",
      });
      for (const [button, delta] of [
        [minus, -1],
        [plus, 1],
      ])
        button.addEventListener("click", () =>
          editRatios((draft) => {
            const bean = draft.beans.find((entry) => entry.id === b.id);
            if (bean) bean.ratio = Math.max(0, Math.min(100, bean.ratio + delta));
          }),
        );
      const balance = n("button", {
        id: `ratio-balance-${b.id}`,
        type: "button",
        class: "mix-ratio-balance",
        text: "Залишок сюди",
        "data-balance-bean": b.id,
      });
      balance.addEventListener("click", () => balanceRatio(b.id));
      const color = ratioColors.get(b.id);
      const segment = n("button", {
        type: "button",
        class: "mix-composition-segment",
        "data-color": color,
        "data-ratio-bean": b.id,
      });
      segment.addEventListener("click", () => {
        slider.scrollIntoView({
          block: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
        slider.focus({ preventScroll: true });
      });
      composition.append(segment);
      ratioControls.set(b.id, { minus, plus, balance, segment });
      const row = n(
        "div",
        { class: "mix-ratio-row" },
        n(
          "div",
          { class: "mix-ratio-head" },
          n(
            "label",
            { class: "mix-ratio-name", for: `ratio-${b.id}` },
            n("span", {
              class: "mix-ratio-swatch",
              "data-color": color,
              "aria-hidden": "true",
              text: String.fromCharCode(65 + color),
            }),
            n("span", { text: p.name }),
          ),
          n(
            "div",
            { class: "mix-ratio-stepper", role: "group", "aria-label": `Частка: ${p.name}` },
            minus,
            n(
              "div",
              { class: "mix-percent-field" },
              number,
              n("span", { "aria-hidden": "true", text: "%" }),
            ),
            plus,
          ),
        ),
        n("div", { class: "mix-ratio-adjust" }, slider, balance),
      );
      row.style.setProperty("--mix-ratio", `${b.ratio}%`);
      rows.append(row);
    });
    roastUI.render(m);
    for (const name of ["weight", "grind", "packaging"])
      form
        .querySelectorAll(`[name="${name}"]`)
        .forEach((i) => (i.checked = String(m[name]) === i.value));
    beanPicker.sync();
    summary();
  }
  cartButton.addEventListener("click", async () => {
    cartButton.disabled = true;
    if (editCartKey) {
      const draft = S.get().draft;
      if (!S.validMix(draft)) {
        summary();
        return;
      }
      const ok = await S.update((state) => {
        const current = state.cart.find(
          (item) => item.type === "mix" && S.lineKey(item) === editCartKey,
        );
        if (!current || JSON.stringify(current.mix) !== editingSnapshot) return false;
        const updated = S.recipe({ ...draft, id: current.mix.id, name: current.mix.name });
        const recipeKey = (mix) =>
          JSON.stringify([
            mix.name,
            [...mix.beans]
              .sort((a, b) => a.id.localeCompare(b.id))
              .map(({ slot, ...bean }) => bean),
            mix.weight,
            mix.grind,
            mix.packaging,
          ]);
        const duplicate = state.cart.find(
          (item) =>
            item !== current && item.type === "mix" && recipeKey(item.mix) === recipeKey(updated),
        );
        if (duplicate && duplicate.qty + current.qty > 99) return false;
        current.mix = updated;
      });
      if (ok) {
        location.href = S.url("cart.html");
        return;
      }
      S.notify("Не вдалося оновити мікс: кошик змінився або дані не збереглися. Перевірте кошик.");
    } else await S.addMix(S.get().draft);
    summary();
  });
  saveButton.addEventListener("click", () => {
    if (window.CoffeeAccount) window.CoffeeAccount.requestSave();
    else S.notify("Збереження тимчасово недоступне. Спробуйте ще раз.");
  });
  resetButton.addEventListener("click", async (e) => {
    e.preventDefault();
    beanSlots.clearError();
    const ok = await S.update((s) => {
      s.draft = S.emptyMix();
    });
    persistence(ok);
    renderFields();
    S.notify(
      ok
        ? "Конструктор очищено."
        : "Конструктор очищено лише на цій сторінці: браузер не зберіг зміни.",
    );
  });
  window.addEventListener("coffee:change", (event) => {
    if (event.detail?.reason === "external" && event.detail.changed?.includes("draft"))
      renderFields();
  });
  renderFields();
  if (
    new URLSearchParams(location.search).get("save") === "1" &&
    !new URLSearchParams(location.search).has("mix")
  ) {
    const url = new URL(location.href);
    url.searchParams.delete("save");
    history.replaceState(null, "", url);
    window.CoffeeAccount?.requestSave();
  }
})();
