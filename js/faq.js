/* Native FAQ enhanced with local search and private, device-only usefulness votes. */
(() => {
  "use strict";
  const page = document.querySelector(".mo-faq-page");
  if (!page) return;
  const $ = (id) => document.getElementById(id);
  const S = window.CoffeeShop;
  for (const card of page.querySelectorAll("[data-mo-faq-pack]")) {
    const pack = S?.packaging?.[card.dataset.moFaqPack];
    if (!pack) continue;
    card.querySelector("strong").textContent = pack.name;
    card.querySelector("span").textContent = pack.price ? `+${S.money(pack.price)}` : "Без доплати";
  }
  const config = window.CoffeeFooterConfig;
  if (config?.socials?.telegram) $("mo-faq-telegram").href = config.socials.telegram;
  if (config?.phoneHref) $("mo-faq-phone").href = config.phoneHref;
  if (config?.email) $("mo-faq-email").href = "mailto:" + config.email;
  const normalize = (value) =>
    value.normalize("NFC").toLocaleLowerCase("uk-UA").replace(/[’ʼ`]/g, "'");
  const compact = (value) => normalize(value).replace(/\s+/g, " ").trim();
  const entries = [...page.querySelectorAll(".mo-faq-question")].map((details) => ({
    details,
    item: details.closest(".mo-faq-item"),
    text: compact(
      details.querySelector("[data-mo-faq-title]").textContent +
        " " +
        details.querySelector("[data-mo-faq-content]").textContent,
    ),
  }));
  const groups = [...page.querySelectorAll(".mo-faq-section")];
  const links = [...page.querySelectorAll("[data-mo-faq-category]")];
  const search = $("mo-faq-search");
  let previousOpen = null,
    query = "";
  $("mo-faq-tools").hidden = false;
  page.querySelectorAll("[data-mo-faq-helpful]").forEach((element) => {
    element.hidden = false;
  });

  function clearHighlights() {
    for (const mark of page.querySelectorAll("mark.mo-faq-highlight")) {
      const parent = mark.parentNode;
      mark.replaceWith(document.createTextNode(mark.textContent));
      parent.normalize();
    }
  }
  function highlight(entry, tokens) {
    const pattern = tokens.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    if (!pattern) return;
    const regex = new RegExp(pattern, "giu");
    for (const container of entry.details.querySelectorAll(
      "[data-mo-faq-title],[data-mo-faq-content]",
    )) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT),
        nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const value = node.textContent,
          normalized = normalize(value),
          matches = [...normalized.matchAll(regex)];
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let start = 0;
        for (const match of matches) {
          const at = match.index,
            end = at + match[0].length;
          fragment.append(document.createTextNode(value.slice(start, at)));
          const mark = document.createElement("mark");
          mark.className = "mo-faq-highlight";
          mark.textContent = value.slice(at, end);
          fragment.append(mark);
          start = end;
        }
        fragment.append(document.createTextNode(value.slice(start)));
        node.replaceWith(fragment);
      }
    }
  }
  function renderSearch() {
    const next = compact(search.value).slice(0, 120),
      tokens = [...new Set(next.split(" ").filter(Boolean))];
    if (next && !query)
      previousOpen = new Set(
        entries.filter((entry) => entry.details.open).map((entry) => entry.details.id),
      );
    clearHighlights();
    let count = 0;
    for (const entry of entries) {
      const match = tokens.every((token) => entry.text.includes(token));
      entry.item.hidden = !match;
      if (match) {
        count++;
        if (next) {
          entry.details.open = true;
          highlight(entry, tokens);
        }
      }
      if (!next && query) entry.details.open = previousOpen?.has(entry.details.id) || false;
    }
    groups.forEach((group, index) => {
      const matches = group.querySelectorAll(".mo-faq-item:not([hidden])").length;
      group.hidden = matches === 0;
      links[index].querySelector(".mo-faq-category-count").textContent = matches;
      links[index].setAttribute("aria-disabled", String(matches === 0));
      links[index].title = matches ? `${matches} запитань` : "У цьому розділі немає збігів";
    });
    query = next;
    $("mo-faq-search-clear").hidden = !search.value;
    $("mo-faq-empty").hidden = count !== 0;
    $("mo-faq-expand").disabled = count === 0;
    $("mo-faq-collapse").disabled = count === 0;
    $("mo-faq-expand").textContent = query ? "Розгорнути знайдені" : "Розгорнути всі";
    $("mo-faq-collapse").textContent = query ? "Згорнути знайдені" : "Згорнути всі";
    $("mo-faq-result-count").textContent = query
      ? `Знайдено ${count} із ${entries.length}`
      : `${entries.length} запитань у ${groups.length} розділах`;
    updateSpy();
  }
  search.addEventListener("input", renderSearch);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && search.value) {
      event.preventDefault();
      clearSearch();
    }
  });
  function clearSearch() {
    search.value = "";
    renderSearch();
    search.focus({ preventScroll: true });
  }
  $("mo-faq-search-clear").addEventListener("click", clearSearch);
  $("mo-faq-reset").addEventListener("click", clearSearch);
  for (const [id, open] of [
    ["mo-faq-expand", true],
    ["mo-faq-collapse", false],
  ]) {
    $(id).addEventListener("click", () => {
      entries
        .filter((entry) => !entry.item.hidden)
        .forEach((entry) => {
          entry.details.open = open;
        });
    });
  }
  for (const { details } of entries) {
    const summary = details.querySelector("summary");
    summary.setAttribute("aria-expanded", String(details.open));
    details.addEventListener("toggle", () => {
      summary.setAttribute("aria-expanded", String(details.open));
      scheduleSpy();
    });
  }

  // Section links remain ordinary fragment links. Only this category bar is sticky.
  const nav = page.querySelector(".mo-faq-nav");
  let spyFrame = 0,
    activeCategory = "";
  function navSize() {
    document.documentElement.style.setProperty(
      "--mo-faq-nav-height",
      `${Math.ceil(nav.getBoundingClientRect().height)}px`,
    );
    scheduleSpy();
  }
  function updateSpy() {
    const visible = groups.filter((group) => !group.hidden);
    const offset = nav.getBoundingClientRect().height + 28;
    const active =
      visible.filter((group) => group.getBoundingClientRect().top <= offset).at(-1) || visible[0];
    links.forEach((link) => {
      if (link.dataset.moFaqCategory === active?.id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    if (active?.id !== activeCategory) {
      activeCategory = active?.id || "";
      const current = links.find((link) => link.dataset.moFaqCategory === activeCategory);
      if (current) {
        const strip = nav.querySelector("ul"),
          bounds = strip.getBoundingClientRect(),
          rect = current.getBoundingClientRect();
        if (rect.right > bounds.right) strip.scrollLeft += rect.right - bounds.right + 4;
        else if (rect.left < bounds.left) strip.scrollLeft -= bounds.left - rect.left + 4;
      }
    }
  }
  function scheduleSpy() {
    if (spyFrame) return;
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      updateSpy();
    });
  }
  addEventListener("scroll", scheduleSpy, { passive: true });
  addEventListener("resize", navSize);
  if ("ResizeObserver" in window) new ResizeObserver(navSize).observe(nav);
  links.forEach((link) =>
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") event.preventDefault();
    }),
  );
  navSize();
  function openFragment() {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const entry = entries.find((entry) => entry.details.id === id);
    if (!entry) {
      scheduleSpy();
      return;
    }
    if (entry.item.hidden) {
      search.value = "";
      renderSearch();
    }
    entry.details.open = true;
    requestAnimationFrame(() => {
      entry.details.scrollIntoView({ block: "start", behavior: "instant" });
      entry.details.querySelector("summary").focus({ preventScroll: true });
      scheduleSpy();
    });
  }
  addEventListener("hashchange", openFragment);
  openFragment();

  const voteKey = "smazhena-kava:faq-feedback:v1";
  const allowed = new Set(entries.map((entry) => entry.details.id));
  function readVotes() {
    try {
      const value = JSON.parse(localStorage.getItem(voteKey));
      return value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).filter(
              ([id, vote]) => allowed.has(id) && ["yes", "no"].includes(vote),
            ),
          )
        : {};
    } catch {
      return {};
    }
  }
  let votes = readVotes();
  function paintVotes() {
    for (const { details } of entries)
      for (const button of details.querySelectorAll("[data-mo-faq-vote]"))
        button.setAttribute("aria-pressed", String(votes[details.id] === button.dataset.moFaqVote));
  }
  for (const { details } of entries)
    for (const button of details.querySelectorAll("[data-mo-faq-vote]")) {
      button.addEventListener("click", () => {
        votes = { ...readVotes(), ...votes };
        if (votes[details.id] === button.dataset.moFaqVote) delete votes[details.id];
        else votes[details.id] = button.dataset.moFaqVote;
        let saved = true;
        try {
          localStorage.setItem(voteKey, JSON.stringify(votes));
        } catch {
          saved = false;
        }
        paintVotes();
        details.querySelector(".mo-faq-vote-note").textContent = saved
          ? "Дякуємо за відповідь."
          : "Вибір позначено, але не вдалося зберегти.";
      });
    }
  addEventListener("storage", (event) => {
    if (event.key === voteKey || event.key === null) {
      votes = readVotes();
      paintVotes();
    }
  });
  paintVotes();
  renderSearch();
})();
