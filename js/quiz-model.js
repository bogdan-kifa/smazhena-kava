/* Illustrative catalogue matching, not a probability or a measured preference. */
(() => {
  "use strict";
  const S = window.CoffeeShop;
  const QUESTIONS = [
    {
      id: "brewing",
      label: "Приготування",
      title: "Як ви готуєте каву?",
      type: "single",
      quick: true,
      weight: 3,
      icon: "mug-hot",
      help: "Спосіб приготування допоможе підібрати профіль і помел.",
      options: [
        ["espresso", "Еспресо", "Кавомашина або ріжкова кавоварка", "mug-hot"],
        ["filter", "Фільтр", "Пуровер, V60 або крапельна кавоварка", "filter"],
        ["cezve", "Джезва", "Турка та кава по-східному", "fire"],
      ],
    },
    {
      id: "milk",
      label: "Молоко",
      title: "З молоком чи без?",
      type: "single",
      quick: false,
      weight: 1,
      icon: "glass-water",
      help: "Для молочних напоїв підтримаємо шоколадні та горіхові ноти.",
      options: [
        ["black", "Чорна кава", "Люблю смак самої кави", "mug-hot"],
        ["milk", "З молоком", "Капучино, лате та інші молочні напої", "glass-water"],
        ["both", "По-різному", "Обидва варіанти під настрій", "shuffle"],
      ],
    },
    {
      id: "taste",
      label: "Смак",
      title: "Які смаки вам подобаються?",
      type: "multi",
      max: 2,
      quick: true,
      weight: 2,
      icon: "leaf",
      help: "Оберіть до двох смаків. Натисніть ще раз, щоб прибрати вибір.",
      options: [
        ["fruity", "Фруктові", "Ягоди, цитруси та соковиті фрукти", "lemon"],
        ["chocolate", "Шоколадні", "Какао, карамель і солодкий післясмак", "cookie-bite"],
        ["nutty", "Горіхові", "Фундук, мигдаль і м’який баланс", "seedling"],
      ],
    },
    {
      id: "acidity",
      label: "Кислотність",
      title: "Як ставитеся до кислотності?",
      type: "single",
      quick: false,
      weight: 3,
      icon: "lemon",
      help: "Йдеться про фруктову свіжість і яскравість смаку.",
      options: [
        ["bright", "Люблю яскраву", "Виразні ягідні й цитрусові відтінки", "lemon"],
        ["some", "Трохи", "Помірна кислотність і солодкий баланс", "scale-balanced"],
        ["low", "Не люблю", "М’який профіль без виразної кислинки", "mug-hot"],
      ],
    },
    {
      id: "strength",
      label: "Міцність",
      title: "Яку насиченість обираєте?",
      type: "single",
      quick: true,
      weight: 2,
      icon: "bolt",
      help: "Міцність тут означає смакову інтенсивність, а не кількість кофеїну.",
      options: [
        ["light", "Делікатна", "Легка чашка й виразні окремі ноти", "feather"],
        ["medium", "Середня", "Збалансована насиченість на щодень", "scale-balanced"],
        ["strong", "Насичена", "Щільніший та інтенсивніший смак", "bolt"],
      ],
    },
    {
      id: "purchase",
      label: "Формат кави",
      title: "Як ви купуєте каву?",
      type: "single",
      quick: false,
      weight: 0,
      icon: "bag-shopping",
      help: "Це налаштує помел у результаті й не вплине на вибір сорту.",
      options: [
        ["beans", "Зерном", "Маю власний млинок", "seedling"],
        ["ground", "Мелену", "Потрібен помел під мій спосіб приготування", "mug-hot"],
        ["unsure", "Не знаю", "Визначуся перед покупкою", "circle-question"],
      ],
    },
    {
      id: "amount",
      label: "Кількість чашок",
      title: "Скільки кави ви п’єте?",
      type: "single",
      quick: false,
      weight: 0,
      optional: true,
      icon: "mug-hot",
      help: "Необов’язково. Запропонуємо початкову вагу — її можна змінити.",
      options: [
        ["one", "1 чашка на день", "Почніть із пакування 250 г", "mug-hot"],
        ["few", "2–3 чашки на день", "Спробуйте пакування 500 г", "mug-hot"],
        ["many", "Багато", "Можна обрати 1 кг", "bag-shopping"],
      ],
    },
  ];
  const draftKey = "smazhena-kava:quiz:draft:v2",
    resultKey = "smazhena-kava:quiz:result:v2";
  let memoryDraft = null,
    memoryResult = null;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function cleanAnswers(value) {
    const result = {};
    if (!value || typeof value !== "object") return result;
    for (const q of QUESTIONS) {
      const allowed = q.options.map((o) => o[0]);
      if (q.type === "multi") {
        const entries = Array.isArray(value[q.id]) ? value[q.id] : [value[q.id]];
        const selected = [...new Set(entries.filter((v) => allowed.includes(v)))].slice(0, q.max);
        if (selected.length) result[q.id] = selected;
      } else if (allowed.includes(value[q.id])) result[q.id] = value[q.id];
    }
    return result;
  }
  function cleanRun(value) {
    if (!value || value.version !== 2 || !["quick", "detail"].includes(value.mode)) return null;
    return {
      version: 2,
      id: typeof value.id === "string" ? value.id.slice(0, 80) : "shared",
      mode: value.mode,
      answers: cleanAnswers(value.answers),
      includeAcidity: value.includeAcidity === true,
      currentQuestion: QUESTIONS.some((q) => q.id === value.currentQuestion)
        ? value.currentQuestion
        : "brewing",
    };
  }
  function plan(run) {
    return QUESTIONS.filter(
      (q) =>
        (run.mode !== "quick" || q.quick) &&
        (q.id !== "acidity" || run.answers.milk !== "milk" || run.includeAcidity),
    );
  }
  function read(key, memory) {
    try {
      return cleanRun(JSON.parse(sessionStorage.getItem(key))) || copy(memory);
    } catch {
      return copy(memory);
    }
  }
  function write(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function rank(raw) {
    const a = cleanAnswers(raw);
    const weights = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.weight]));
    return S.products
      .filter((p) => !S.isGreen(p))
      .map((p) => {
        let points = 0,
          maximum = 0;
        const reasons = [];
        const add = (earned, max, reason) => {
          points += earned;
          maximum += max;
          if (earned > 0 && reason) reasons.push(reason);
        };
        if (a.brewing) {
          const match = S.brewingMethods(p).includes(a.brewing);
          add(
            match ? weights.brewing : 0,
            weights.brewing,
            match ? `Обсмаження під ${S.grinds[a.brewing].toLocaleLowerCase("uk")}` : "",
          );
        }
        if (a.acidity) {
          const actual = p.taste.acidity >= 75 ? 2 : p.taste.acidity >= 45 ? 1 : 0;
          const desired = { low: 0, some: 1, bright: 2 }[a.acidity];
          const difference = Math.abs(actual - desired);
          add(
            difference === 0 ? weights.acidity : difference === 1 ? weights.acidity / 2 : 0,
            weights.acidity,
            difference === 0 ? `Кислотність: ${p.acidity.toLocaleLowerCase("uk")}` : "",
          );
        }
        if (a.taste?.length) {
          const matches = a.taste.filter((v) => p.profiles.includes(v));
          add(
            matches.length * weights.taste,
            a.taste.length * weights.taste,
            matches.length
              ? `Смак: ${matches
                  .map((v) =>
                    QUESTIONS.find((q) => q.id === "taste")
                      .options.find((o) => o[0] === v)[1]
                      .toLocaleLowerCase("uk"),
                  )
                  .join(", ")}`
              : "",
          );
        }
        if (a.strength) {
          const target = { light: 2, medium: 3, strong: 4 }[a.strength];
          const difference = Math.abs(p.strength - target);
          add(
            difference === 0 ? weights.strength : difference === 1 ? weights.strength / 2 : 0,
            weights.strength,
            difference === 0 ? "Бажана смакова інтенсивність" : "",
          );
        }
        if (a.milk === "milk") {
          const match =
            p.profiles.some((v) => ["chocolate", "nutty"].includes(v)) || p.roast === "dark";
          add(
            match ? weights.milk : 0,
            weights.milk,
            match ? "Шоколадні або горіхові ноти для молока" : "",
          );
        }
        return {
          product: p,
          points,
          maximum,
          percent: maximum ? Math.round((points / maximum) * 100) : null,
          reasons,
        };
      })
      .sort((a, b) => b.points - a.points || a.product.id.localeCompare(b.product.id));
  }
  function toURL(run) {
    const url = new URL(S.url("quiz-result.html"));
    url.searchParams.set("v", "2");
    url.searchParams.set("mode", run.mode);
    for (const [id, value] of Object.entries(cleanAnswers(run.answers)))
      url.searchParams.set(id, Array.isArray(value) ? value.join(",") : value);
    return url.href;
  }
  function fromURL() {
    const params = new URLSearchParams(location.search);
    if (params.get("v") !== "2") return null;
    const raw = Object.fromEntries(
      QUESTIONS.map((q) => [
        q.id,
        q.type === "multi" ? (params.get(q.id) || "").split(",") : params.get(q.id),
      ]),
    );
    return {
      version: 2,
      id: "shared",
      mode: params.get("mode") === "detail" ? "detail" : "quick",
      answers: cleanAnswers(raw),
      includeAcidity: Boolean(params.get("acidity")),
    };
  }
  function mixURL(product, weight, grind, save = false) {
    const url = new URL(S.url("constructor.html"));
    url.searchParams.set("mix", `${product.id}:100`);
    url.searchParams.set("weight", String(weight));
    if (["espresso", "filter", "cezve"].includes(grind)) url.searchParams.set("grind", grind);
    if (save) url.searchParams.set("save", "1");
    return url.href;
  }
  window.CoffeeQuiz = Object.freeze({
    QUESTIONS,
    cleanAnswers,
    rank,
    plan,
    toURL,
    fromURL,
    mixURL,
    newRun: (mode) => ({
      version: 2,
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
      mode,
      answers: {},
      includeAcidity: false,
      currentQuestion: "brewing",
    }),
    loadDraft: () => read(draftKey, memoryDraft),
    loadResult: () => read(resultKey, memoryResult),
    saveDraft: (run) => {
      memoryDraft = cleanRun(run);
      return write(draftKey, memoryDraft);
    },
    saveResult: (run) => {
      memoryResult = cleanRun(run);
      return write(resultKey, memoryResult);
    },
    clearDraft: () => {
      memoryDraft = null;
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* In-memory fallback remains usable. */
      }
    },
    recommendedWeight: (a) => ({ one: 250, few: 500, many: 1000 })[a.amount] || 250,
    recommendedGrind: (a) =>
      a.purchase === "beans" ? "beans" : a.purchase === "ground" && a.brewing ? a.brewing : "",
  });
})();
