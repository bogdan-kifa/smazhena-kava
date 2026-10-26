(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S;
  const questions = [
    {
      id: "taste",
      title: "Які смаки вам подобаються?",
      options: [
        ["fruity", "Фруктові", "Ягоди, цитруси та соковита кислотність"],
        ["chocolate", "Шоколадні", "Какао, карамель і м’який смак"],
        ["nutty", "Горіхові", "Горіхові ноти й збалансований профіль"],
      ],
    },
    {
      id: "brewing",
      title: "Як ви заварюєте каву?",
      options: [
        ["espresso", "Еспресо", "Кавомашина або ріжкова кавоварка"],
        ["filter", "Фільтр", "Пуровер, V60 чи аеропрес"],
        ["cezve", "Джезва", "Турка або кава по-східному"],
      ],
    },
    {
      id: "strength",
      title: "Яку міцність обираєте?",
      options: [
        ["light", "Делікатну", "Легкий профіль і виразні ноти"],
        ["medium", "Збалансовану", "Середня насиченість на щодень"],
        ["strong", "Насичену", "Щільніший та інтенсивніший смак"],
      ],
    },
  ];
  const form = document.getElementById("quiz-form");
  if (form) {
    let step = 0,
      pendingAnswer = Promise.resolve(true),
      savingAnswer = false,
      answerWrite = 0;
    const title = document.getElementById("quiz-question-title");
    title.tabIndex = -1;
    const field = document.getElementById("quiz-answer-options"),
      progress = document.getElementById("quiz-progress"),
      status = document.getElementById("quiz-status");
    field.disabled = false;
    status.textContent =
      "Три запитання для базового підбору кави. Рекомендація ґрунтується на характеристиках каталогу.";
    const prev = form.querySelector('[data-action="previous-question"]'),
      next = form.querySelector('[data-action="next-question"]'),
      skip = form.querySelector('[data-action="skip-question"]');
    skip.disabled = false;
    function answers() {
      const dl = document.querySelector(".quiz-answers");
      if (dl) {
        const values = S.get().quiz;
        dl.replaceChildren(
          ...questions.map((q) =>
            n(
              "div",
              {},
              n("dt", {
                text: q.id === "taste" ? "Смак" : q.id === "brewing" ? "Приготування" : "Міцність",
              }),
              n("dd", {
                text: q.options.find((x) => x[0] === values[q.id])?.[1] || "Ще не обрано",
              }),
            ),
          ),
        );
      }
    }
    function render(focus = false) {
      const q = questions[step],
        answer = S.get().quiz[q.id];
      title.textContent = q.title;
      title.previousElementSibling.textContent = `Питання ${step + 1} з ${questions.length}`;
      title.nextElementSibling.textContent =
        "Оберіть відповідь, щоб звузити підбір кави. Можна пропустити запитання.";
      form.querySelector(".quiz-help").hidden = q.id !== "brewing";
      field.replaceChildren(n("legend", { class: "visually-hidden", text: q.title }));
      const choices = n("div", { class: "quiz-choices" });
      for (const [value, label, description] of q.options) {
        const id = `quiz-${q.id}-${value}`,
          radio = n("input", {
            id,
            type: "radio",
            class: "visually-hidden quiz-choice-input",
            name: q.id,
            value,
            checked: answer === value,
          });
        radio.addEventListener("change", async () => {
          const write = ++answerWrite;
          savingAnswer = true;
          next.disabled = prev.disabled = skip.disabled = true;
          pendingAnswer = S.update((s) => (s.quiz[q.id] = value));
          const persisted = await pendingAnswer;
          if (write !== answerWrite) return;
          savingAnswer = false;
          prev.disabled = step === 0;
          skip.disabled = false;
          next.disabled = !persisted;
          if (!persisted)
            S.notify(
              "Не вдалося зберегти відповідь. Дозвольте сховище браузера й оберіть відповідь знову.",
            );
          answers();
        });
        choices.append(
          radio,
          n(
            "label",
            { for: id, class: "quiz-choice-label" },
            n("strong", { text: label }),
            n("span", { class: "muted", text: description }),
          ),
        );
      }
      field.append(choices);
      progress.setAttribute("aria-label", `Питання ${step + 1} з ${questions.length}`);
      progress.replaceChildren(
        ...questions.map((q, i) =>
          n(
            "li",
            {
              class: i < step ? "quiz-progress-complete" : "",
              "aria-current": i === step ? "step" : null,
            },
            n("span", {
              class: "visually-hidden",
              text: `Питання ${i + 1}${i === step ? ": поточне" : ""}`,
            }),
          ),
        ),
      );
      prev.disabled = step === 0;
      next.disabled = !q.options.some((x) => x[0] === answer);
      next.textContent = step === 2 ? "Підібрати каву" : "Далі";
      answers();
      if (focus) {
        title.scrollIntoView({ block: "start", behavior: "instant" });
        title.focus({ preventScroll: true });
      }
    }
    function forward() {
      if (step < questions.length - 1) {
        step++;
        render(true);
      } else location.href = S.url("quiz-result.html");
    }
    prev.addEventListener("click", () => {
      if (!savingAnswer && step > 0) {
        step--;
        render(true);
      }
    });
    next.addEventListener("click", async () => {
      if ((await pendingAnswer) && !next.disabled && !savingAnswer) forward();
    });
    skip.addEventListener("click", async () => {
      if (savingAnswer) return;
      savingAnswer = true;
      next.disabled = prev.disabled = skip.disabled = true;
      const persisted = await S.update((s) => delete s.quiz[questions[step].id]);
      savingAnswer = false;
      if (persisted) forward();
      else {
        render();
        S.notify(
          "Не вдалося зберегти пропуск запитання. Дозвольте сховище браузера й повторіть дію.",
        );
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if ((await pendingAnswer) && !next.disabled && !savingAnswer) forward();
    });
    render();
    return;
  }
  const article = document.querySelector(".quiz-result-product");
  // Клас статичного макета може відрізнятися, але заголовок результату є стабільною точкою.
  const heading = document.getElementById("quiz-result-title");
  if (!heading) return;
  const root = article || heading.closest("article"),
    answer = S.get().quiz;
  const score = (p) =>
    (p.profiles.includes(answer.taste) ? 5 : 0) +
    (answer.brewing === "filter" && p.roast === "light" ? 3 : 0) +
    (answer.brewing !== "filter" && p.roast === "medium" ? 2 : 0) +
    (answer.strength === "strong"
      ? p.strength
      : answer.strength === "light"
        ? 6 - p.strength
        : 3 - Math.abs(3 - p.strength));
  const ranked = [...S.products].sort((a, b) => score(b) - score(a));
  let index = 0;
  const selected = new URLSearchParams(location.search).get("product");
  if (ranked.some((p) => p.id === selected)) index = ranked.findIndex((p) => p.id === selected);
  const field = document.querySelector(".quiz-result-weight");
  field.disabled = false;
  const buy = document.querySelector(".quiz-result-actions a"),
    another = document.querySelector('[data-action="next-recommendation"]');
  another.disabled = false;
  function render() {
    const p = ranked[index],
      path = S.url(`products/${p.id}.html`),
      weight = Number(field.querySelector(":checked")?.value) || 250;
    const photo = document.querySelector(".quiz-result-photo");
    root.dataset.product = p.id;
    photo.href = path;
    photo.setAttribute("aria-label", `${p.name} — детальніше`);
    photo.querySelector("img").src = S.url(p.image);
    photo.querySelector("img").alt = `Кавові зерна: ${p.name}`;
    heading.replaceChildren(n("a", { class: "product-title-link", href: path, text: p.name }));
    document.querySelector(".quiz-result-description").textContent = p.notes;
    document.querySelector(".quiz-result-information > .eyebrow").textContent =
      `${p.originLabel} · ${{ light: "Світле", medium: "Середнє", dark: "Темне" }[p.roast]}`;
    document.querySelector(".quiz-heading > .eyebrow").textContent =
      `Рекомендація ${index + 1} з ${ranked.length}`;
    const pairs = document.querySelectorAll(".quiz-result-specifications dd");
    if (pairs[0]) pairs[0].textContent = p.processing;
    if (pairs[1])
      pairs[1].textContent = { light: "Світле", medium: "Середнє", dark: "Темне" }[p.roast];
    if (pairs[3]) pairs[3].textContent = p.acidity;
    document.querySelector(".quiz-result-price").textContent = S.money(S.productPrice(p, weight));
    document.querySelector(".quiz-reason-description").textContent = Object.keys(answer).length
      ? `Орієнтовний підбір за вашими відповідями: смаковими нотами, способом приготування та бажаною міцністю. ${p.notes}`
      : "Це приклад кави з каталогу. Пройдіть квіз, щоб отримати підбір за своїми вподобаннями.";
    const status = document.getElementById("quiz-result-status");
    status.textContent = `Рекомендація ${index + 1} з ${ranked.length}. Оберіть вагу або перегляньте інший варіант.`;
    status.classList.remove("visually-hidden");
    buy.href = S.url("cart.html");
    buy.onclick = async (e) => {
      e.preventDefault();
      if (await S.addProduct(p.id, weight, answer.brewing || "beans"))
        location.href = S.url("cart.html");
    };
    history.replaceState(null, "", `?product=${p.id}`);
  }
  another.addEventListener("click", () => {
    index = (index + 1) % ranked.length;
    render();
    heading.tabIndex = -1;
    heading.scrollIntoView({ block: "start", behavior: "instant" });
    heading.focus({ preventScroll: true });
  });
  field.addEventListener("change", render);
  render();
})();
