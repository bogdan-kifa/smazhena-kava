/* ЛР №7: довідка із зовнішнього MediaWiki API; бізнес-логіка магазину не змінюється. */
(() => {
  const widget = document.getElementById("coffee-fact");
  if (!widget) return;

  // Тут тільки назви перевірених статей. Сам текст надходить із Вікіпедії.
  const topics = [
    "Аеропрес",
    "Кемекс",
    "Джезва",
    "Еспресо",
    "Капучино",
    "Лате",
    "Френч-прес",
    "Ристрето",
  ];
  const content = document.getElementById("coffee-fact-content");
  const heading = document.getElementById("coffee-fact-topic");
  const text = document.getElementById("coffee-fact-text");
  const source = document.getElementById("coffee-fact-source");
  const date = document.getElementById("coffee-fact-date");
  const status = document.getElementById("coffee-fact-status");
  const retry = document.getElementById("coffee-fact-retry");
  const storageKey = "smazhena-kava:coffee-fact:v2";
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const labelFormat = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let loadedDay = "";
  let attemptedDay = "";
  let busy = false;
  let started = false;

  function today() {
    const now = new Date();
    const parts = Object.fromEntries(
      dayFormat.formatToParts(now).map((part) => [part.type, part.value]),
    );
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    const dayNumber = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
    return { key, label: labelFormat.format(now), topic: topics[dayNumber % topics.length] };
  }

  function valid(record, day) {
    return (
      record &&
      record.day === day.key &&
      record.topic === day.topic &&
      typeof record.title === "string" &&
      record.title.length > 0 &&
      record.title.length < 120 &&
      typeof record.text === "string" &&
      record.text.length >= 30 &&
      record.text.length <= 260 &&
      Number.isSafeInteger(record.revision) &&
      record.revision > 0
    );
  }

  function shortExcerpt(article) {
    const paragraphs = article.extract.split(/\n+/).filter((part) => part.trim());
    // Ці абзаци дають короткі факти без довгих вступів з етимологією.
    const paragraph =
      paragraphs[article.title === "Еспресо" || article.title === "Ристрето" ? 1 : 0];
    if (!paragraph) throw new Error("Missing selected paragraph");
    const excerpt = paragraph.replace(/\s+/g, " ").trim();
    const sentences = [];
    let depth = 0,
      start = 0;
    for (let i = 0; i < excerpt.length; i++) {
      if (excerpt[i] === "(") depth++;
      if (excerpt[i] === ")") depth = Math.max(0, depth - 1);
      // Скорочення на кшталт «італ.» у дужках не розривають речення.
      if (
        depth === 0 &&
        /[.!?]/.test(excerpt[i]) &&
        (i + 1 === excerpt.length || /\s/.test(excerpt[i + 1]))
      ) {
        sentences.push(excerpt.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
    const first = sentences[0];
    if (!first) throw new Error("Incomplete source sentence");
    const pair = sentences.slice(0, 2).join(" ");
    if (pair.length <= 190) return pair;
    if (first.length <= 250) return first;
    return `${first.slice(0, 247).replace(/\s+\S*$/, "")}…`;
  }

  function render(record, restoreFocus = false) {
    // Зовнішній текст вставляється тільки як текст, а посилання будуємо на фіксованому домені.
    heading.textContent = record.title;
    text.textContent = record.text;
    const url = new URL("https://uk.wikipedia.org/w/index.php");
    url.searchParams.set("title", record.title);
    url.searchParams.set("oldid", record.revision);
    source.href = url.href;
    source.setAttribute(
      "aria-label",
      `Читати у Вікіпедії: стаття «${record.title}», у новій вкладці`,
    );
    loadedDay = record.day;
    widget.dataset.state = "ready";
    status.textContent = "Нова тема щодня за київським часом.";
    retry.hidden = true;
    if (restoreFocus) source.focus({ preventScroll: true });
  }

  async function load(force = false) {
    if (busy) return;
    const day = today();
    if (!force && loadedDay === day.key) return;
    attemptedDay = day.key;
    const restoreFocus = document.activeElement === retry;
    date.dateTime = day.key;
    date.textContent = day.label;
    started = true;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(storageKey));
        if (valid(cached, day)) {
          render(cached, restoreFocus);
          return;
        }
      } catch {
        /* Віджет працює й без доступу до localStorage. */
      }
    }

    busy = true;
    widget.dataset.state = "loading";
    content.setAttribute("aria-busy", "true");
    retry.disabled = true;
    heading.textContent = day.topic;
    text.textContent = "Завантажуємо коротку довідку про каву…";
    status.textContent = "Завантаження факту дня…";
    source.href = `https://uk.wikipedia.org/wiki/${encodeURIComponent(day.topic)}`;
    source.removeAttribute("aria-label");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL("https://uk.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        origin: "*",
        prop: "extracts|info|pageprops",
        ppprop: "disambiguation",
        exintro: "1",
        explaintext: "1",
        exchars: "1000",
        redirects: "1",
        titles: day.topic,
      });
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Unavailable source");
      const data = await response.json();
      const article = data.query?.pages?.[0];
      if (
        !article ||
        article.missing ||
        article.pageprops?.disambiguation !== undefined ||
        typeof article.extract !== "string"
      )
        throw new Error("Missing coffee article");
      const record = {
        day: day.key,
        topic: day.topic,
        title: article.title,
        text: shortExcerpt(article),
        revision: article.lastrevid,
      };
      if (!valid(record, day)) throw new Error("Invalid coffee extract");
      // Запит, який завершився після опівночі, не видаємо за довідку нового дня.
      if (today().key !== day.key) return;
      render(record, restoreFocus);
      try {
        localStorage.setItem(storageKey, JSON.stringify(record));
      } catch {
        /* Кеш необов'язковий. */
      }
    } catch {
      widget.dataset.state = "error";
      text.textContent =
        "Зараз не вдалося завантажити факт дня. Спробуй ще раз або прочитай про сьогоднішню кавову тему у Вікіпедії.";
      status.textContent = "Джерело тимчасово недоступне. Посилання на статтю працює окремо.";
      retry.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      content.setAttribute("aria-busy", "false");
      retry.disabled = false;
      if (restoreFocus && widget.dataset.state === "error") retry.focus({ preventScroll: true });
      busy = false;
      if (today().key !== day.key) load();
    }
  }

  const initialDay = today();
  date.dateTime = initialDay.key;
  date.textContent = initialDay.label;
  date.hidden = false;
  retry.addEventListener("click", () => load(true));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(widget);
  } else load();
  // Після повернення на вкладку та при зміні дати оновлюємо добірку без перезавантаження.
  document.addEventListener("visibilitychange", () => {
    if (started && !document.hidden && attemptedDay !== today().key) load();
  });
  window.setInterval(() => {
    if (started && !document.hidden && attemptedDay !== today().key) load();
  }, 60000);
})();
