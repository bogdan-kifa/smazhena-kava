(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S;
  const savedList = document.querySelector(".saved-mixes-grid");
  if (savedList) {
    document.getElementById("saved-mixes-status").textContent =
      "Рецепти зберігаються локально у цьому браузері, без реєстрації та синхронізації з акаунтом.";
    document.getElementById("saved-mixes-status").classList.remove("visually-hidden");
    const render = () => {
      const active = document.activeElement;
      const activeCard = active?.closest("[data-recipe-id]");
      const previousCards = [...savedList.querySelectorAll("[data-recipe-id]")];
      const focus = savedList.contains(active)
        ? {
            id: activeCard?.dataset.recipeId,
            index: previousCards.indexOf(activeCard),
            action: active.dataset.recipeAction,
          }
        : null;
      savedList.replaceChildren();
      const saved = S.get().saved;
      if (!saved.length)
        savedList.append(
          n(
            "li",
            { class: "shop-empty" },
            n("p", { text: "Збережених міксів ще немає." }),
            n("a", { class: "button", href: S.url("constructor.html"), text: "Створити мікс" }),
          ),
        );
      saved.forEach((m, index) => {
        const repeat = n("button", {
          class: "button saved-mix-repeat",
          type: "button",
          "data-recipe-action": "repeat",
          text: "Додати в кошик",
        });
        repeat.addEventListener("click", async () => {
          if (repeat.getAttribute("aria-busy") === "true") return;
          repeat.setAttribute("aria-busy", "true");
          try {
            await S.addMix(m);
          } finally {
            repeat.setAttribute("aria-busy", "false");
          }
        });
        const edit = n("button", {
          class: "button button-secondary saved-mix-edit",
          type: "button",
          "data-recipe-action": "edit",
          text: "Редагувати",
        });
        edit.addEventListener("click", async () => {
          const ok = await S.update((s) => {
            const current = s.saved.find((saved) => saved.id === m.id);
            if (!current) return false;
            s.draft = current;
          });
          if (ok) location.href = S.url("constructor.html");
          else
            S.notify(
              "Не вдалося відкрити рецепт: браузер не зберіг вибір. Дозвольте сховище та спробуйте ще раз.",
            );
        });
        const remove = n("button", {
          class: "button button-secondary",
          type: "button",
          "data-recipe-action": "remove",
          "aria-label": `Видалити рецепт «${m.name}»`,
          text: "Видалити",
        });
        remove.addEventListener("click", async () => {
          const ok = await S.update((s) => {
            s.saved = s.saved.filter((x) => x.id !== m.id);
          });
          S.notify(
            ok ? "Рецепт видалено." : "Не вдалося видалити рецепт. Браузер не зберіг зміни.",
          );
        });
        const pair = (key, value) => n("div", {}, n("dt", { text: key }), n("dd", { text: value }));
        savedList.append(
          n(
            "li",
            {},
            n(
              "article",
              {
                class: "card saved-mix-card",
                "aria-labelledby": `saved-${index}`,
                "data-recipe-id": m.id,
              },
              n(
                "header",
                { class: "saved-mix-header" },
                n("h2", { id: `saved-${index}`, text: m.name }),
                recipeDate(m),
              ),
              n(
                "dl",
                { class: "saved-mix-details" },
                pair("Склад", S.composition(m)),
                pair("Вага", `${m.weight} г`),
                pair("Помел", S.grinds[m.grind]),
                pair("Вартість", S.money(S.mixPrice(m))),
              ),
              n("div", { class: "saved-mix-actions" }, repeat, edit, remove),
            ),
          ),
        );
      });
      if (focus) {
        const cards = [...savedList.querySelectorAll("[data-recipe-id]")];
        const card =
          cards.find((item) => item.dataset.recipeId === focus.id) ||
          cards[Math.min(Math.max(0, focus.index), cards.length - 1)];
        const next =
          card?.querySelector(`[data-recipe-action="${focus.action}"]`) ||
          card?.querySelector("button,a") ||
          savedList.querySelector("button,a");
        next?.focus({ preventScroll: true });
      }
    };
    function recipeDate(m) {
      const key = m.updatedAt && m.updatedAt !== m.createdAt ? "updatedAt" : "createdAt";
      const value = m[key];
      if (!value || !Number.isFinite(Date.parse(value)))
        return n("p", { class: "muted saved-mix-date", text: "Дата збереження невідома" });
      return n(
        "p",
        { class: "muted saved-mix-date" },
        `${key === "updatedAt" ? "Оновлено" : "Збережено"} `,
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
    window.addEventListener("coffee:change", (event) => {
      if (!event.detail?.changed || event.detail.changed.includes("saved")) render();
    });
    render();
    return;
  }
  const form = document.getElementById("mix-form");
  if (!form) return;
  form.querySelector(".mix-settings").disabled = false;
  form.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("mix-account-hint").textContent = "Збереження локальне, без акаунта.";
  const status = document.getElementById("mix-form-status");
  status.textContent =
    "До чотирьох сортів. Налаштуйте частки кожного сорту окремо, щоб у сумі було рівно 100%. Тоді можна зберегти мікс або додати його до кошика.";
  status.classList.remove("visually-hidden");
  const options = form.querySelector(".mix-options");
  const add = n(
    "div",
    { class: "shop-mix-picker" },
    n("label", { for: "mix-add-product", text: "Додати сорт до міксу" }),
  );
  const select = n(
    "select",
    { id: "mix-add-product" },
    n("option", { value: "", text: "Оберіть каву" }),
    S.products.map((p) => n("option", { value: p.id, text: p.name })),
  );
  const addButton = n("button", {
    type: "button",
    class: "button button-secondary",
    text: "Додати сорт",
  });
  addButton.addEventListener("click", async () => {
    if (select.value) {
      addButton.disabled = true;
      await S.addBean(select.value);
      renderFields();
      select.value = "";
    }
  });
  add.append(select, addButton);
  options.after(add);
  const nameField = n(
    "div",
    { class: "checkout-field" },
    n("label", { for: "mix-name", text: "Назва міксу" }),
  );
  const nameInput = n("input", {
    id: "mix-name",
    type: "text",
    maxlength: 60,
    value: S.get().draft.name,
  });
  nameField.append(nameInput);
  status.after(nameField);
  const roastSection = form.querySelector('[aria-labelledby="mix-roast-title"]');
  roastSection.replaceChildren(
    n(
      "div",
      { class: "mix-step-heading" },
      n("h2", { id: "mix-roast-title", class: "mix-step-title", text: "4 Обсмаження" }),
    ),
    n("p", {
      class: "muted",
      text: "Для наявних обсмажених сортів профіль уже заданий. Він зберігається у складі міксу.",
    }),
    n("div", { id: "mix-roast-list" }),
  );
  const profile = document.getElementById("mix-profile-title").parentElement;
  const strengthTemplate = document.querySelector(".mix-strength-icons").cloneNode(true);
  profile.replaceChildren(
    n("h3", { id: "mix-profile-title", class: "mix-summary-subheading", text: "Смаковий профіль" }),
    n("ul", { class: "mix-flavor-notes", id: "mix-notes" }),
    n("p", { class: "muted", text: "Орієнтир за описами обраних сортів." }),
  );
  const buttons = document.querySelectorAll(".mix-summary-actions button");
  buttons.forEach((b) => (b.disabled = false));
  const [cartButton, saveButton, resetButton] = buttons;
  const actionStatus = n("p", {
    id: "mix-action-status",
    class: "mix-action-status",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
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
  const strengthHelp = n("p", {
    class: "mix-strength-help",
    text: "Умовна смакова інтенсивність за описами сортів; це не показник кофеїну.",
  });
  document.querySelectorAll(".mix-summary-list")[1].after(strengthHelp);
  let draftWrites = 0;
  function persistence(ok) {
    persistenceStatus.hidden = ok;
    persistenceStatus.textContent = ok
      ? ""
      : "Браузер не зберіг зміни. Вони доступні лише на цій сторінці. Дозвольте сховище перед переходом або збереженням рецепта.";
    persistenceStatus.dataset.invalid = String(!ok);
  }
  const totalBadge = document.querySelector(".mix-total-badge");
  totalBadge.id = "mix-total-status";
  totalBadge.setAttribute("role", "status");
  totalBadge.setAttribute("aria-live", "polite");
  totalBadge.setAttribute("aria-atomic", "true");
  document.querySelector(".mix-summary-actions").append(
    n("a", {
      class: "shop-text-link",
      href: S.url("my-mixes.html"),
      text: "Мої збережені мікси",
    }),
  );
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
  let scheduledName = null;
  const scheduledRatios = new Map();
  async function writeName() {
    const value = nameInput.value.trim() || "Мій мікс";
    if (scheduledName?.value === value) return scheduledName.promise;
    if (!scheduledName && S.get().draft.name === value) return true;
    const request = { value };
    scheduledName = request;
    request.promise = setDraft((m) => {
      m.name = value;
    });
    try {
      return await request.promise;
    } finally {
      if (scheduledName === request) scheduledName = null;
    }
  }
  nameInput.addEventListener("input", writeName);
  nameInput.addEventListener("change", async () => {
    const value = nameInput.value.trim() || "Мій мікс";
    await writeName();
    nameInput.value = value;
  });
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
    const pair = (key, value) => n("div", {}, n("dt", { text: key }), n("dd", {}, value));
    const lists = document.querySelectorAll(".mix-summary-list");
    lists[0].replaceChildren(...m.beans.map((b) => pair(S.byId.get(b.id).name, `${b.ratio}%`)));
    if (!m.beans.length) lists[0].append(pair("Склад", "Оберіть зерна з каталогу"));
    lists[1].replaceChildren(
      pair("Вага", `${m.weight} г`),
      pair("Помел", S.grinds[m.grind]),
      pair("Пакування", `Тип тари ${m.packaging} · без доплати`),
      pair("Міцність", strength(m, ready)),
    );
    const activeBeans = m.beans.filter((bean) => bean.ratio > 0);
    document.getElementById("mix-notes").replaceChildren(
      ...(activeBeans.length
        ? activeBeans.map((bean) => {
            const p = S.byId.get(bean.id);
            return n(
              "li",
              {},
              n("strong", { text: p.name }),
              n("span", { text: p.notes.split(".")[0] }),
            );
          })
        : [n("li", { text: "Додайте сорт і встановіть його частку." })]),
    );
    document.querySelector(".mix-price").textContent = ready ? S.money(total) : "—";
    document.querySelector(".mix-delivery-row span:last-child").textContent = !ready
      ? "Встановіть 100%"
      : total >= 80000
        ? "Доступна"
        : S.money(80000 - total);
    document.querySelector(".mix-delivery-progress").value = Math.min(800, total / 100);
    const totalText = !m.beans.length
      ? "0% · додайте зерна"
      : ready
        ? "100% · готово"
        : percentage < 100
          ? `${percentage}% · додайте ${100 - percentage}%`
          : `${percentage}% · зменште на ${percentage - 100}%`;
    totalBadge.textContent = totalText;
    totalBadge.dataset.invalid = String(!ready);
    actionStatus.textContent = !m.beans.length
      ? "Додайте хоча б один сорт. Збереження й кошик доступні, коли сума часток дорівнює 100%."
      : !ready
        ? `Сума часток — ${percentage}%. ${percentage < 100 ? `Додайте ще ${100 - percentage}%` : `Зменште частки на ${percentage - 100}%`}, щоб зберегти мікс або додати його до кошика.`
        : draftWrites
          ? "Зберігаємо налаштування…"
          : "Сума часток — 100%. Мікс готовий до збереження й замовлення.";
    actionStatus.dataset.invalid = String(!ready);
    cartButton.disabled = saveButton.disabled = !ready || draftWrites > 0;
    cartButton.setAttribute("aria-busy", String(draftWrites > 0));
    saveButton.setAttribute("aria-busy", String(draftWrites > 0));
  }
  function strength(m, ready) {
    const icons = strengthTemplate.cloneNode(true);
    const rating = ready
      ? Math.round(
          m.beans.reduce((sum, bean) => sum + S.byId.get(bean.id).strength * bean.ratio, 0) / 100,
        )
      : 0;
    icons
      .querySelectorAll(".mix-strength-bean")
      .forEach((bean, index) => bean.classList.toggle("mix-strength-bean-filled", index < rating));
    return n(
      "span",
      { class: "mix-strength-value" },
      n("span", {
        class: "visually-hidden",
        text: ready
          ? `${rating} з 5; смакова інтенсивність`
          : "Встановіть суму часток 100%, щоб визначити смакову інтенсивність",
      }),
      icons,
    );
  }
  async function ratio(id, value) {
    if (!S.get().draft.beans.some((b) => b.id === id)) return;
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      S.notify("Вкажіть ціле число від 0 до 100.");
      renderFields();
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
  function renderFields() {
    const m = S.get().draft;
    options.replaceChildren();
    document.querySelector(".mix-step .muted").textContent = `${m.beans.length} з 4 сортів`;
    m.beans.forEach((b) => {
      const p = S.byId.get(b.id),
        remove = n("button", {
          class: "mix-bean-remove",
          type: "button",
          "aria-label": `Прибрати сорт «${p.name}»`,
          text: "×",
        });
      remove.addEventListener("click", async () => {
        await setDraft((d) => {
          d.beans = d.beans.filter((x) => x.id !== b.id);
        });
        renderFields();
        select.focus();
      });
      options.append(
        n(
          "div",
          { class: "mix-bean-chip" },
          n("span", { class: "mix-bean-select", text: p.name }),
          remove,
        ),
      );
    });
    if (!m.beans.length)
      options.append(n("p", { class: "muted", text: "Обраних сортів ще немає." }));
    const rows = document.querySelector(".mix-ratios");
    rows.replaceChildren();
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
          "aria-describedby": "mix-proportions-help mix-total-status",
        }),
        number = n("input", {
          id: `percent-${b.id}`,
          type: "number",
          min: 0,
          max: 100,
          step: 1,
          value: b.ratio,
          "aria-describedby": "mix-proportions-help mix-total-status",
          "aria-label": `Частка кави ${p.name}, відсотків`,
        });
      slider.addEventListener("input", () => ratio(b.id, Number(slider.value)));
      number.addEventListener("input", () => {
        const value = number.valueAsNumber;
        if (Number.isInteger(value) && value >= 0 && value <= 100) ratio(b.id, value);
      });
      number.addEventListener("change", () => ratio(b.id, number.valueAsNumber));
      const row = n(
        "div",
        { class: "mix-ratio-row" },
        n("label", { class: "mix-ratio-name", for: `ratio-${b.id}`, text: p.name }),
        slider,
        n(
          "div",
          { class: "mix-percent-field" },
          number,
          n("span", { "aria-hidden": "true", text: "%" }),
        ),
      );
      row.style.setProperty("--mix-ratio", `${b.ratio}%`);
      rows.append(row);
    });
    document.getElementById("mix-roast-list").replaceChildren(
      ...m.beans.map((b) =>
        n("p", {
          class: "muted",
          text: `${S.byId.get(b.id).name} · ${{ light: "світле", medium: "середнє", dark: "темне" }[S.byId.get(b.id).roast]}`,
        }),
      ),
    );
    for (const name of ["weight", "grind", "packaging"])
      form
        .querySelectorAll(`[name="${name}"]`)
        .forEach((i) => (i.checked = String(m[name]) === i.value));
    nameInput.value = m.name;
    addButton.disabled = m.beans.length >= 4;
    summary();
  }
  cartButton.addEventListener("click", async () => {
    cartButton.disabled = true;
    await S.addMix(S.get().draft);
    summary();
  });
  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    let failure = "Не вдалося зберегти рецепт. Дозвольте сховище браузера та повторіть спробу.";
    const ok = await S.update((s) => {
      const m = S.mix(s.draft);
      if (!S.validMix(m)) {
        failure = "Оберіть зерна та встановіть суму пропорцій 100%.";
        return false;
      }
      const existing = s.saved.find((saved) => saved.id === m.id);
      if (!existing && s.saved.length >= 30) {
        failure = "Збережено максимум 30 рецептів. Видаліть зайві.";
        return false;
      }
      const now = new Date().toISOString();
      m.id = m.id || S.uid();
      m.createdAt = existing ? existing.createdAt || "" : m.createdAt || now;
      m.updatedAt = now;
      const recipe = S.recipe(m);
      const i = s.saved.findIndex((saved) => saved.id === m.id);
      if (i < 0) s.saved.push(recipe);
      else s.saved[i] = recipe;
      s.draft = m;
    });
    if (ok) {
      persistence(true);
      S.notify("Рецепт збережено.", { href: "my-mixes.html", text: "Мої мікси" });
    } else {
      S.notify(failure);
      persistenceStatus.hidden = false;
      persistenceStatus.textContent = failure;
      persistenceStatus.dataset.invalid = "true";
    }
    summary();
  });
  resetButton.addEventListener("click", async (e) => {
    e.preventDefault();
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
})();
