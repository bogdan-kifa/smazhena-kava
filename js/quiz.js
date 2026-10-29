(() => {
  "use strict";
  const S = window.CoffeeShop,
    Q = window.CoffeeQuiz,
    n = S.node;
  const app = document.getElementById("quiz-app"),
    results = document.getElementById("quiz-results");
  if (!app && !results) return;
  const paths = {
    "mug-hot": "M4 8h13v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 9h2a3 3 0 0 1 0 6h-2M7 2v3m4-4v4m4-3v3",
    filter: "M3 3h18l-7 9v8l-4 2V12z",
    fire: "M12 2c2 6 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4s3-3 1-9z",
    lemon: "M4 16C-1 8 9 1 16 5l4-1-1 4c5 8-5 15-12 11l-4 1zM8 9c2-2 5-2 7 0",
    "cookie-bite": "M21 13A9 9 0 1 1 11 3a4 4 0 0 0 5 5 4 4 0 0 0 5 5zM7 10h.1M10 16h.1M15 14h.1",
    seedling: "M12 22V12C4 13 2 7 3 3c6 0 9 3 9 9 0-6 4-9 9-9 1 6-2 10-9 9",
    leaf: "M20 3C8 1 1 9 5 16c6 7 16-2 15-13zM5 20 17 7",
    "glass-water": "M5 3h14l-2 19H7zM6 10c4-3 8 3 12 0",
    shuffle: "M3 5h3l12 14h3m-4-4 4 4-4 4M3 19h3l4-5m4-5 4-4h3m-4-4 4 4-4 4",
    "scale-balanced": "M12 2v20M4 6h16M4 6 1 14h6zm16 0-3 8h6zM7 22h10",
    feather: "M20 3C11-2 3 8 7 15l-4 6 6-4C17 21 25 10 20 3zM7 17 17 7",
    bolt: "m13 1-9 13h7l-1 9 10-14h-7z",
    "bag-shopping": "M4 7h16v15H4zM8 7V5a4 4 0 0 1 8 0v2",
    "circle-question":
      "M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 3m0 3h.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  };
  function icon(name, className = "quiz-icon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      class: className,
    }))
      svg.setAttribute(k, v);
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] || paths["mug-hot"]);
    svg.append(path);
    return svg;
  }
  function answerLabel(q, a) {
    const values = Array.isArray(a[q.id]) ? a[q.id] : [a[q.id]];
    return q.options
      .filter((o) => values.includes(o[0]))
      .map((o) => o[1])
      .join(", ");
  }
  if (app) {
    let run = null,
      step = 0;
    const panel = document.getElementById("quiz-answer-panel"),
      leader = document.getElementById("quiz-leader");
    panel.closest("details").open = matchMedia("(min-width:1100px)").matches;
    const storageNote = n("p", { class: "quiz-storage-note", role: "status", hidden: true });
    const announce = n("p", {
      class: "visually-hidden",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    app.after(storageNote, announce);
    function persist() {
      storageNote.hidden = Q.saveDraft(run);
      storageNote.textContent =
        "Ця вкладка не може зберегти проходження. Ви можете продовжити без перезавантаження.";
      history.replaceState({ ...history.state, quizRun: run }, "");
    }
    function route(id, replace = false) {
      const hash = id === "start" ? "#start" : `#q${Q.QUESTIONS.findIndex((q) => q.id === id) + 1}`;
      history[replace ? "replaceState" : "pushState"]({ quizRun: run }, "", hash);
    }
    function go(index, replace = false) {
      const steps = Q.plan(run);
      step = Math.max(0, Math.min(index, steps.length - 1));
      run.currentQuestion = steps[step].id;
      route(steps[step].id, replace);
      persist();
      render(true);
    }
    function start(mode, saved = null) {
      run = saved || Q.newRun(mode);
      go(
        Math.max(
          0,
          Q.plan(run).findIndex((q) => q.id === run.currentQuestion),
        ),
      );
    }
    function welcome() {
      app.closest(".quiz-layout").classList.add("mo-quiz-welcome");
      panel.closest(".quiz-sidebar").hidden = true;
      run = null;
      panel.replaceChildren(
        n("p", { class: "muted", text: "Поки що відповідей немає. Оберіть режим і почнімо." }),
      );
      leader.hidden = true;
      storageNote.hidden = true;
      const modes = n("div", { class: "quiz-mode-options" });
      for (const [mode, title, count, time, description] of [
        [
          "quick",
          "Швидкий підбір",
          "3 питання",
          "≈ 30 секунд",
          "Спосіб приготування, улюблені смаки та насиченість.",
        ],
        [
          "detail",
          "Докладний підбір",
          "До 7 питань",
          "≈ 1 хвилина",
          "Додамо молоко, кислотність, формат кави та кількість чашок.",
        ],
      ]) {
        const button = n(
          "button",
          { type: "button", class: "quiz-mode", "data-mode": mode },
          n(
            "span",
            { class: "quiz-mode-top" },
            icon(mode === "quick" ? "bolt" : "leaf"),
            n("span", { text: time }),
          ),
          n("strong", { text: title }),
          n("span", { class: "quiz-mode-count", text: count }),
          n("span", { class: "muted", text: description }),
          n("span", { class: "quiz-mode-start", text: "Почати →" }),
        );
        button.addEventListener("click", () => start(mode));
        modes.append(button);
      }
      app.replaceChildren(
        n(
          "div",
          { class: "quiz-welcome-heading" },
          icon("mug-hot", "quiz-welcome-illustration"),
          n(
            "div",
            {},
            n("p", { class: "eyebrow", text: "Знайдемо вашу чашку" }),
            n("h2", { text: "Кава під ваш смак" }),
            n("p", {
              class: "muted",
              text: "Без обов’язкових відповідей. Можна пропустити будь-яке питання.",
            }),
          ),
        ),
        modes,
      );
    }
    function sidebar() {
      panel.replaceChildren(
        ...Q.plan(run).map((q, index) => {
          const label = answerLabel(q, run.answers);
          const button = n("button", {
            type: "button",
            class: "quiz-answer-edit",
            "aria-label": `${label ? "Змінити" : "Обрати"}: ${q.label}${label ? `, зараз ${label}` : ""}`,
            text: label ? `${label} · змінити` : "Обрати",
          });
          button.addEventListener("click", () => go(index));
          return n(
            "div",
            { class: "quiz-answer-row" },
            n("span", { class: "muted", text: q.label }),
            button,
          );
        }),
      );
      if (run.mode === "detail" && run.answers.milk === "milk" && !run.includeAcidity) {
        const button = n("button", {
          class: "quiz-branch-restore",
          type: "button",
          text: "Додати питання про кислотність",
        });
        button.addEventListener("click", () => {
          run.includeAcidity = true;
          persist();
          go(Q.plan(run).findIndex((q) => q.id === "acidity"));
        });
        panel.append(
          n("p", {
            class: "quiz-branch-note",
            text: "Питання про кислотність пропущено для кави з молоком. Відповідь не припускаємо.",
          }),
          button,
        );
      }
      const top = Q.rank(run.answers)[0];
      leader.hidden = top.percent === null;
      if (!leader.hidden) {
        leader.querySelector(".quiz-leader-name").textContent = top.product.name;
        leader.querySelector(".quiz-leader-score").textContent = `${top.percent}%`;
        const meter = leader.querySelector("meter");
        meter.value = top.percent;
        meter.textContent = `${top.percent}% орієнтовного збігу`;
      }
    }
    function finish() {
      Q.saveResult(run);
      Q.clearDraft();
      location.href = Q.toURL(run);
    }
    function forward(skip) {
      if (skip) delete run.answers[Q.plan(run)[step].id];
      persist();
      if (step === Q.plan(run).length - 1) finish();
      else go(step + 1);
    }
    function render(focus = false) {
      app.closest(".quiz-layout").classList.remove("mo-quiz-welcome");
      panel.closest(".quiz-sidebar").hidden = false;
      const steps = Q.plan(run),
        q = steps[step],
        answered = () => Boolean(answerLabel(q, run.answers));
      const title = n("h2", { id: "quiz-question-title", tabindex: -1, text: q.title }),
        progress = n("div", { class: "quiz-progress-container" });
      if (steps.length <= 5)
        progress.append(
          n(
            "ol",
            { class: "quiz-steps", "aria-label": "Кроки підбору" },
            ...steps.map((item, index) =>
              n(
                "li",
                {
                  "aria-current": index === step ? "step" : null,
                  class: index < step ? "is-complete" : "",
                },
                n("span", { text: item.label }),
              ),
            ),
          ),
        );
      else
        progress.append(
          n(
            "div",
            { class: "quiz-progress-caption" },
            n("span", { text: `Питання ${step + 1} з ${steps.length}` }),
            n("strong", { text: q.label }),
          ),
          n("progress", {
            class: "quiz-long-progress",
            max: steps.length,
            value: step + 1,
            "aria-label": `Питання ${step + 1} з ${steps.length}: ${q.label}`,
            text: `${step + 1} з ${steps.length}`,
          }),
        );
      const form = n("form", { id: "quiz-form", "aria-labelledby": "quiz-question-title" });
      const field = n(
        "fieldset",
        {
          id: "quiz-answer-options",
          class: "quiz-choice-group",
          "aria-describedby": "quiz-question-help",
        },
        n("legend", { class: "visually-hidden", text: q.title }),
      );
      const choices = n("div", { class: "quiz-choices" }),
        inputs = [];
      const next = n("button", { class: "button", type: "submit", "data-action": "next-question" });
      const skip = n("button", {
        class: "button quiz-button-quiet",
        type: "button",
        "data-action": "skip-question",
        text: "Пропустити",
      });
      function syncChoices() {
        const activeSteps = Q.plan(run);
        const bar = progress.querySelector("progress");
        if (bar) {
          bar.max = activeSteps.length;
          bar.setAttribute("aria-label", `Питання ${step + 1} з ${activeSteps.length}: ${q.label}`);
          bar.textContent = `${step + 1} з ${activeSteps.length}`;
          progress.querySelector(".quiz-progress-caption > span").textContent =
            `Питання ${step + 1} з ${activeSteps.length}`;
        }
        const values = run.answers[q.id] || [];
        for (const input of inputs)
          input.disabled =
            q.type === "multi" && values.length >= q.max && !values.includes(input.value);
        const last = step === activeSteps.length - 1;
        next.textContent = answered()
          ? last
            ? "Показати підбір"
            : "Далі"
          : last
            ? "Пропустити й показати підбір"
            : "Пропустити";
        skip.hidden = !answered();
      }
      for (const [value, label, description, name] of q.options) {
        const id = `quiz-${q.id}-${value}`,
          input = n("input", {
            class: "visually-hidden quiz-choice-input",
            id,
            name: q.id,
            type: q.type === "multi" ? "checkbox" : "radio",
            value,
            checked:
              q.type === "multi" ? run.answers[q.id]?.includes(value) : run.answers[q.id] === value,
          });
        inputs.push(input);
        input.addEventListener("change", () => {
          if (q.type === "multi")
            run.answers[q.id] = inputs.filter((i) => i.checked).map((i) => i.value);
          else run.answers[q.id] = value;
          if (q.id === "milk" && value === "milk" && !run.includeAcidity)
            delete run.answers.acidity;
          persist();
          syncChoices();
          sidebar();
          if (q.type === "multi")
            announce.textContent = `Обрано ${run.answers[q.id].length} з ${q.max} смаків`;
        });
        choices.append(
          input,
          n(
            "label",
            { for: id, class: "quiz-choice-label" },
            n("span", { class: "quiz-choice-icon" }, icon(name)),
            n(
              "span",
              { class: "quiz-choice-copy" },
              n("strong", { text: label }),
              n("span", { class: "muted", text: description }),
            ),
            n("span", { class: "quiz-choice-mark", "aria-hidden": "true", text: "✓" }),
          ),
        );
      }
      field.append(choices);
      syncChoices();
      const prev = n("button", {
        class: "button quiz-button-quiet",
        type: "button",
        "data-action": "previous-question",
        text: step === 0 ? "До режимів" : "Назад",
      });
      prev.addEventListener("click", () => {
        if (step === 0) {
          route("start");
          welcome();
        } else go(step - 1);
      });
      skip.addEventListener("click", () => forward(true));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        forward(false);
      });
      form.append(
        field,
        n(
          "div",
          { class: "quiz-actions" },
          prev,
          n("div", { class: "quiz-actions-forward" }, skip, next),
        ),
      );
      app.replaceChildren(
        progress,
        n("p", {
          class: "eyebrow",
          text: steps.length <= 5 ? `Питання ${step + 1} з ${steps.length}` : "Ваші вподобання",
        }),
        title,
        n("p", { class: "muted", id: "quiz-question-help", text: q.help }),
        form,
      );
      sidebar();
      if (focus) {
        title.focus({ preventScroll: true });
        app.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
    function restoreRoute() {
      const match = /^#q([1-7])$/.exec(location.hash);
      if (!match) {
        welcome();
        return;
      }
      const routeRun = history.state?.quizRun;
      if (routeRun && run?.id !== routeRun.id) run = routeRun;
      run = run || routeRun || Q.loadDraft();
      if (!run) {
        welcome();
        return;
      }
      run.answers = Q.cleanAnswers(run.answers);
      const id = Q.QUESTIONS[Number(match[1]) - 1].id;
      if (id === "acidity" && run.answers.milk === "milk") run.includeAcidity = true;
      step = Q.plan(run).findIndex((q) => q.id === id);
      if (step < 0) {
        go(0, true);
        return;
      }
      render(true);
    }
    window.addEventListener("popstate", restoreRoute);
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) restoreRoute();
    });
    if (location.hash.startsWith("#q")) restoreRoute();
    else {
      history.replaceState({ quizRun: null }, "", location.pathname + location.search);
      welcome();
    }
    return;
  }
  const run = Q.fromURL() || Q.loadResult() || Q.newRun("quick"),
    ranked = Q.rank(run.answers).slice(0, 3),
    weightDefault = Q.recommendedWeight(run.answers),
    grindDefault = Q.recommendedGrind(run.answers);
  const status = document.getElementById("quiz-result-status");
  document.getElementById("quiz-result-intro").textContent = ranked[0].maximum
    ? "Три найближчі варіанти за вашими відповідями. Відсоток — орієнтовний збіг із характеристиками каталогу."
    : "Поки немає смакових відповідей для оцінки збігу. Ось три варіанти з каталогу — їх можна переглянути або пройти квіз.";
  results.replaceChildren(
    ...ranked.map(({ product: p, percent, reasons }, index) => {
      let weight = weightDefault, adding = false;
      const photo = n(
        "a",
        {
          class: "quiz-result-photo",
          href: S.url(`products/${p.id}.html`),
          "aria-label": `${p.name} — детальніше`,
        },
        n("img", {
          src: S.url(p.image),
          alt: p.imageAlt || `Упаковка: ${p.name}`,
          width: 1536,
          height: 1024,
          loading: index ? "lazy" : "eager",
        }),
      );
      const price = n("p", {
        class: "quiz-result-price",
        text: S.money(S.productPrice(p, weight)),
      });
      const grind = n(
        "select",
        { id: `grind-${p.id}`, class: "quiz-result-grind", "aria-describedby": `grind-help-${p.id}` },
        n("option", { value: "", text: "Оберіть помел" }),
        ...Object.entries(S.grinds).map(([value, text]) =>
          n("option", { value, text, selected: value === grindDefault }),
        ),
      );
      const grindHelp = n("p", {
        id: `grind-help-${p.id}`, class: "mo-quiz-grind-help", "aria-live": "polite",
        text: "Оберіть помел перед додаванням у кошик.", hidden: Boolean(grindDefault),
      });
      const buy = n("button", {
        class: "button",
        type: "button",
        text: "Додати в кошик",
        "aria-describedby": `grind-help-${p.id}`,
      });
      const mix = n("a", {
        class: "button button-secondary quiz-result-mix-link",
        text: "Зібрати мікс із цього сорту",
      });
      function links() {
        mix.href = Q.mixURL(p, weight, grind.value);
      }
      grind.addEventListener("change", () => {
        grind.removeAttribute("aria-invalid");
        grindHelp.hidden = Boolean(grind.value);
        grindHelp.classList.remove("mo-quiz-grind-error");
        grindHelp.textContent = "Оберіть помел перед додаванням у кошик.";
        links();
      });
      buy.addEventListener("click", async () => {
        if (adding) return;
        if (!grind.value) {
          grindHelp.hidden = false;
          grindHelp.textContent = "Оберіть помел, щоб додати каву до кошика.";
          grindHelp.classList.add("mo-quiz-grind-error");
          grind.setAttribute("aria-invalid", "true");
          grind.focus();
          return;
        }
        adding = true;
        buy.disabled = true;
        buy.setAttribute("aria-busy", "true");
        try {
          if (!(await S.addProduct(p.id, weight, grind.value)))
            status.textContent = "Не вдалося додати каву. Спробуйте ще раз.";
        } catch {
          status.textContent = "Не вдалося додати каву. Спробуйте ще раз.";
        } finally {
          adding = false;
          buy.disabled = false;
          buy.removeAttribute("aria-busy");
        }
      });
      const weights = n("fieldset", { class: "quiz-result-weight" }, n("legend", { text: "Вага" })),
        options = n("div", { class: "quiz-result-weight-options" });
      for (const value of [250, 500, 1000]) {
        const id = `weight-${p.id}-${value}`,
          input = n("input", {
            class: "visually-hidden",
            id,
            name: `weight-${p.id}`,
            type: "radio",
            value,
            checked: value === weight,
          });
        input.addEventListener("change", () => {
          weight = value;
          price.textContent = S.money(S.productPrice(p, weight));
          links();
        });
        options.append(
          input,
          n("label", { for: id, class: "quiz-result-weight-label", text: `${value} г` }),
        );
      }
      weights.append(options);
      links();
      const reasonText = reasons.length
        ? reasons.join(". ") + "."
        : percent === null
          ? "Варіант із каталогу без оцінки персонального збігу."
          : "Найближчий доступний профіль; точних збігів за відповідями немає.";
      const info = n(
        "div",
        { class: "quiz-result-information" },
        n(
          "div",
          { class: "quiz-result-topline" },
          n("p", {
            class: "eyebrow",
            text: index === 0 ? "Перший варіант" : `Альтернатива ${index}`,
          }),
          n("span", {
            class: "quiz-match",
            text: percent === null ? "З каталогу" : `${percent}% збігу`,
          }),
        ),
        n(
          "h2",
          { class: "quiz-result-title" },
          n("a", {
            class: "product-title-link",
            href: S.url(`products/${p.id}.html`),
            text: p.name,
          }),
        ),
        n("p", {
          class: "quiz-result-origin",
          text: `${p.originLabel} · ${S.roasts[p.roast]} обсмаження`,
        }),
        n("p", { class: "quiz-result-description", text: p.notes }),
        n("p", { class: "quiz-match-reasons", text: reasonText }),
        weights,
        n(
          "div",
          { class: "quiz-grind-field" },
          n("label", { for: `grind-${p.id}`, text: "Помел" }),
          grind,
          grindHelp,
        ),
        price,
        n("div", { class: "quiz-result-actions" }, buy),
        n("div", { class: "quiz-result-links" }, mix),
      );
      return n("article", { class: "card quiz-result-card", "data-product": p.id }, photo, info);
    }),
  );
  const answerList = document.getElementById("quiz-result-answers");
  for (const q of Q.QUESTIONS) {
    const label = answerLabel(q, run.answers);
    if (label)
      answerList.append(n("div", {}, n("dt", { text: q.label }), n("dd", { text: label })));
  }
  if (!answerList.children.length)
    answerList.replaceWith(
      n("p", { class: "muted", text: "Питання пропущені. Можна почати новий підбір." }),
    );
})();
