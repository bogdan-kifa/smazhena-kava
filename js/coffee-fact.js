/* Local, source-checked facts: instant first paint, daily Kyiv rotation and optional cache. */
(() => {
  "use strict";
  const widget = document.getElementById("coffee-fact"),
    facts = window.COFFEE_FACTS;
  if (!widget || !Array.isArray(facts) || !facts.length) return;
  const heading = document.getElementById("coffee-fact-topic"),
    text = document.getElementById("coffee-fact-text"),
    source = document.getElementById("coffee-fact-source"),
    sourceLabel = document.getElementById("coffee-fact-source-label"),
    date = document.getElementById("coffee-fact-date");
  const storageKey = "smazhena-kava:coffee-fact:v3",
    byId = new Map(facts.map((f) => [f.id, f]));
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
  });
  let loadedDay = "",
    index = 0;
  function today() {
    const now = new Date(),
      parts = Object.fromEntries(dayFormat.formatToParts(now).map((p) => [p.type, p.value])),
      key = `${parts.year}-${parts.month}-${parts.day}`;
    return {
      key,
      label: labelFormat.format(now),
      number: Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000),
    };
  }
  function remember(day) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ day: day.key, id: facts[index].id }));
    } catch {
      /* Optional: the widget still works in private/restricted storage. */
    }
  }
  function render(day) {
    const f = facts[index];
    heading.textContent = f.title;
    text.textContent = f.text;
    source.href = f.source;
    sourceLabel.textContent = `Джерело: ${f.sourceName === "World Coffee Research" ? "WCR" : f.sourceName}`;
    source.title = f.sourceName;
    source.setAttribute("aria-label", `Джерело: ${f.sourceName}, у новій вкладці`);
    date.dateTime = day.key;
    date.textContent = day.label;
    date.hidden = false;
    widget.dataset.state = "ready";
    widget.dataset.factId = f.id;
    loadedDay = day.key;
  }
  function load() {
    const day = today();
    if (loadedDay === day.key) return;
    index = ((day.number % facts.length) + facts.length) % facts.length;
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey));
      if (cached?.day === day.key && byId.has(cached.id))
        index = facts.findIndex((f) => f.id === cached.id);
    } catch {
      /* Corrupt cache never becomes display text. */
    }
    render(day);
    remember(day);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) load();
  });
  window.addEventListener("pageshow", load);
  // Poll only for the calendar boundary; no network requests are needed.
  window.setInterval(() => {
    if (!document.hidden) load();
  }, 60000);
  load();
})();
