/* Спільні дані браузерного прототипу. Жодні персональні дані чи платежі не зберігаються. */
(() => {
  "use strict";
  const root = new URL("../", document.currentScript.src);
  const products = window.COFFEE_PRODUCTS;
  const byId = new Map(products.map((p) => [p.id, p]));
  const key = "smazhena-kava:shop:v1";
  const { weights, grinds, roasts, packaging, available } = window.CoffeeRules;
  const isGreen = (product) => product?.category === "green";
  // Shared illustrative method preferences; no beans are excluded by this hint.
  const brewingMethods = (product) =>
    isGreen(product)
      ? []
      : product.roast === "light"
        ? ["filter"]
        : product.roast === "dark"
          ? ["espresso", "cezve"]
          : ["espresso", "filter", "cezve"];
  const beanRoast = (bean) =>
    isGreen(byId.get(bean.id)) ? bean.roast || "medium" : byId.get(bean.id).roast;
  const beanStrength = (bean) => {
    const product = byId.get(bean.id);
    return isGreen(product) ? product.strengthByRoast?.[beanRoast(bean)] ?? 0 : product?.strength ?? 0;
  };
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const emptyMix = () => ({
    id: "",
    name: "Мій мікс",
    beans: [],
    weight: 200,
    grind: "filter",
    packaging: "1",
  });
  const integer = (n, min, max, fallback) =>
    Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const isoDate = (value) =>
    typeof value === "string" && value.length <= 35 && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : "";
  function withBeanSlots(beans) {
    const used = new Set();
    const planned = beans.map((bean) => {
      if (Number.isInteger(bean.slot) && bean.slot >= 0 && bean.slot < 4 && !used.has(bean.slot)) {
        used.add(bean.slot);
        return bean.slot;
      }
      return null;
    });
    return beans
      .map((bean, index) => {
        const slot = planned[index] ?? [0, 1, 2, 3].find((value) => !used.has(value));
        used.add(slot);
        return { ...bean, slot };
      })
      .sort((a, b) => a.slot - b.slot);
  }
  const beanFamily = (product) => `${product.origin}:${product.variantOf || product.id}`;
  function mix(value) {
    if (!value || typeof value !== "object") return emptyMix();
    const seen = new Set();
    const beans = (Array.isArray(value.beans) ? value.beans : [])
      .filter((b) => b && byId.has(b.id) && !seen.has(b.id) && seen.add(b.id))
      .slice(0, 4)
      .map((b) => ({
        id: b.id,
        ratio: integer(b.ratio, 0, 100, 0),
        slot: b.slot,
        ...(isGreen(byId.get(b.id))
          ? { roast: Object.hasOwn(roasts, b.roast) ? b.roast : "medium" }
          : {}),
      }));
    return {
      id: typeof value.id === "string" && /^[\w-]{1,80}$/.test(value.id) ? value.id : "",
      name:
        typeof value.name === "string" ? value.name.trim().slice(0, 60) || "Мій мікс" : "Мій мікс",
      beans: withBeanSlots(beans),
      weight: weights.includes(value.weight) ? value.weight : 200,
      grind: Object.hasOwn(grinds, value.grind) ? value.grind : "filter",
      packaging: ["1", "2", "3"].includes(value.packaging) ? value.packaging : "1",
      createdAt: isoDate(value.createdAt),
      updatedAt: isoDate(value.updatedAt),
    };
  }
  const validMix = (m) =>
    m.beans.length > 0 &&
    m.beans.every((b) => Number.isInteger(b.ratio) && b.ratio >= 0 && b.ratio <= 100) &&
    m.beans.reduce((s, b) => s + b.ratio, 0) === 100;
  function recipe(value) {
    const result = mix(value);
    result.beans = result.beans.filter((b) => b.ratio > 0);
    return result;
  }
  function mixSignature(value) {
    const m = recipe(value);
    return JSON.stringify([
      m.name,
      [...m.beans].sort((a, b) => a.id.localeCompare(b.id)).map(({ slot, ...bean }) => bean),
      m.weight,
      m.grind,
      m.packaging,
    ]);
  }
  function normalize(v = {}) {
    if (!v || typeof v !== "object") v = {};
    const cart = [];
    for (const item of (Array.isArray(v.cart) ? v.cart : []).slice(0, 50)) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "product" && byId.has(item.id) && [250, 500, 1000].includes(item.weight)) {
        const green = isGreen(byId.get(item.id));
        const roast = green && Object.hasOwn(roasts, item.roast) ? item.roast : "raw";
        const grind =
          !(green && roast === "raw") && Object.hasOwn(grinds, item.grind) ? item.grind : "beans";
        const entry = {
          type: "product",
          id: item.id,
          weight: item.weight,
          grind,
          ...(green ? { roast } : {}),
          qty: integer(item.qty, 1, 99, 1),
        };
        const existing = cart.find(
          (x) =>
            x.type === "product" &&
            x.id === entry.id &&
            x.weight === entry.weight &&
            x.grind === entry.grind &&
            x.roast === entry.roast,
        );
        if (existing) existing.qty = Math.min(99, existing.qty + entry.qty);
        else cart.push(entry);
      } else if (item.type === "mix") {
        const m = recipe(item.mix);
        if (validMix(m) && m.id) {
          const existing = cart.find(
            (x) => x.type === "mix" && mixSignature(x.mix) === mixSignature(m),
          );
          const qty = integer(item.qty, 1, 99, 1);
          if (existing) existing.qty = Math.min(99, existing.qty + qty);
          else cart.push({ type: "mix", mix: m, qty });
        }
      }
    }
    return {
      version: 1,
      cart,
      favorites: [
        ...new Set((Array.isArray(v.favorites) ? v.favorites : []).filter((id) => byId.has(id))),
      ],
      draft: mix(v.draft),
      saved: (Array.isArray(v.saved) ? v.saved : [])
        .map(recipe)
        .filter((m) => m.id && validMix(m))
        .slice(0, 30),
      quiz:
        v.quiz && typeof v.quiz === "object"
          ? Object.fromEntries(
              ["brewing", "taste", "strength"]
                .filter((k) => typeof v.quiz[k] === "string")
                .map((k) => [k, v.quiz[k].slice(0, 30)]),
            )
          : {},
    };
  }
  const sessionKey = `${key}:session`;
  let sharedWrites = typeof navigator.locks?.request === "function";
  let storageMode = sharedWrites ? "local" : "session";
  const volatileKeys = new Set();
  const stateFields = ["cart", "favorites", "draft", "saved", "quiz"];
  function read(fallback = {}) {
    try {
      const temporary = sessionStorage.getItem(sessionKey);
      if (temporary) {
        storageMode = "session";
        return normalize(JSON.parse(temporary));
      }
    } catch {
      /* Тимчасове сховище також може бути заблоковане. */
    }
    try {
      return normalize(JSON.parse(localStorage.getItem(key)) || {});
    } catch {
      return normalize(fallback);
    }
  }
  let state = read();
  function storageNotice() {
    let banner = document.getElementById("shop-storage-warning");
    if (storageMode === "local") {
      banner?.remove();
      return;
    }
    if (!banner) {
      banner = node("p", { id: "shop-storage-warning", class: "shop-nojs", role: "status" });
      document.body.prepend(banner);
    }
    banner.textContent =
      storageMode === "session"
        ? "Постійне збереження недоступне. Вибір зберігатиметься лише до закриття цієї вкладки."
        : "Збереження заблоковане браузером. Вибір доступний лише на цій сторінці й не переноситься при переході.";
  }
  function changedFields(before, after) {
    return stateFields.filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    );
  }
  function applyState(next, reason) {
    const changed = changedFields(state, next);
    state = next;
    storageNotice();
    if (changed.length)
      window.dispatchEvent(new CustomEvent("coffee:change", { detail: { changed, reason } }));
  }
  function latestState() {
    const next = read(state);
    for (const field of volatileKeys) next[field] = copy(state[field]);
    return next;
  }
  function persist(next) {
    const data = JSON.stringify(next);
    if (sharedWrites && storageMode !== "session") {
      try {
        localStorage.setItem(key, data);
        storageMode = "local";
        volatileKeys.clear();
        return true;
      } catch {
        /* A blocked or full persistent store falls back to this tab. */
      }
    }
    try {
      sessionStorage.setItem(sessionKey, data);
      storageMode = "session";
      volatileKeys.clear();
      return true;
    } catch {
      storageMode = "memory";
      return false;
    }
  }
  // Every mutation reads and writes under the same origin-wide lock. No stale tab snapshot is saved.
  let mutationQueue = Promise.resolve();
  function withStateLock(task) {
    const operation = mutationQueue.then(async () => {
      if (!sharedWrites) return task();
      try {
        return await navigator.locks.request(`${key}:mutation`, { mode: "exclusive" }, task);
      } catch (error) {
        if (error.name !== "SecurityError" && error.name !== "NotSupportedError") throw error;
        sharedWrites = false;
        storageMode = "session";
        return task();
      }
    });
    mutationQueue = operation.catch(() => {});
    return operation;
  }
  function update(fn) {
    return withStateLock(() => {
      const current = latestState(),
        next = copy(current);
      if (fn(next) === false) {
        applyState(current, "external");
        return false;
      }
      const clean = normalize(next),
        changed = changedFields(current, clean);
      if (!changed.length) {
        applyState(current, "external");
        return storageMode !== "memory";
      }
      const saved = persist(clean);
      if (saved) applyState(clean, "local");
      else if (changed.every((field) => ["draft", "favorites", "quiz"].includes(field))) {
        changed.forEach((field) => volatileKeys.add(field));
        applyState(clean, "local");
      } else applyState(current, "external");
      return saved;
    });
  }
  function node(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (v === true) n.setAttribute(k, "");
      else n.setAttribute(k, String(v));
    }
    for (const c of children.flat(Infinity)) {
      if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  }
  const url = (path) => new URL(path, root).href;
  const money = (cents) =>
    new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      maximumFractionDigits: cents % 100 ? 2 : 0,
    })
      .format(cents / 100)
      .replace(/грн\.?/u, "₴");
  const productPrice = (p, weight = 250) => Math.round((p.price * weight) / 250);
  const mixPrice = (m) =>
    Math.round(
      (m.beans.reduce((s, b) => s + (byId.get(b.id).price * b.ratio) / 100, 0) * m.weight) / 250,
    ) + (packaging[m.packaging]?.price || 0);
  const tasteDimensions = {
    acidity: "Кислотність",
    sweetness: "Солодкість",
    bitterness: "Гіркота",
  };
  // Weighted illustrative scores; preserve the draft and never scale incomplete proportions to 100%.
  function mixTaste(m) {
    if (
      !m ||
      !Array.isArray(m.beans) ||
      !m.beans.every((bean) => bean && typeof bean === "object") ||
      !validMix(m)
    )
      return null;
    const result = Object.fromEntries(Object.keys(tasteDimensions).map((key) => [key, 0]));
    for (const bean of m.beans) {
      if (bean.ratio === 0) continue;
      const product = byId.get(bean.id);
      const scores = isGreen(product) ? product.tasteByRoast?.[beanRoast(bean)] : product?.taste;
      if (!scores) return null;
      for (const key of Object.keys(tasteDimensions)) {
        if (!Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 100) return null;
        result[key] += (scores[key] * bean.ratio) / 100;
      }
    }
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, Math.round(value)]),
    );
  }
  const lineKey = (item) =>
    item.type === "product"
      ? `p:${item.id}:${item.weight}:${item.grind}${isGreen(byId.get(item.id)) ? `:${item.roast || "raw"}` : ""}`
      : `m:${item.mix.id}`;
  const unit = (item) =>
    item.type === "product" ? productPrice(byId.get(item.id), item.weight) : mixPrice(item.mix);
  const total = () => state.cart.reduce((s, i) => s + unit(i) * i.qty, 0);
  const name = (item) => (item.type === "product" ? byId.get(item.id).name : item.mix.name);
  const composition = (m) =>
    m.beans
      .map(
        (b) =>
          `${byId.get(b.id).name} ${b.ratio}%${isGreen(byId.get(b.id)) ? ` (${roasts[beanRoast(b)].toLocaleLowerCase("uk")} обсмаження)` : ""}`,
      )
      .join(" · ");
  const packagingText = (m) =>
    `${packaging[m.packaging]?.name || packaging["1"].name}${packaging[m.packaging]?.price ? ` (+${money(packaging[m.packaging].price)})` : " · без доплати"}`;
  const itemDetails = (item) =>
    item.type === "product"
      ? `${isGreen(byId.get(item.id)) ? (item.roast && item.roast !== "raw" ? `${roasts[item.roast]} обсмаження · ` : "Без обсмаження · ") : ""}${grinds[item.grind]}`
      : `${composition(item.mix)} · ${grinds[item.mix.grind]} · ${packagingText(item.mix)}`;
  let noticeBox,
    noticeMessage,
    noticeAction,
    noticeClose,
    noticeIcon,
    noticeProgress,
    noticeAnnouncer;
  let noticeTimer,
    noticeExitTimer,
    noticeStarted = 0,
    noticeRemaining = 2000;
  let noticeHovered = false,
    noticeClosing = false,
    noticeOpener = null;
  const noticeMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function stopNoticeClock() {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
      noticeRemaining = Math.max(0, noticeRemaining - (performance.now() - noticeStarted));
    }
    if (noticeProgress) noticeProgress.style.animationPlayState = "paused";
  }
  function dismissNotice() {
    if (!noticeBox || noticeBox.hidden || noticeClosing) return;
    stopNoticeClock();
    noticeClosing = true;
    noticeBox.classList.add("is-leaving");
    if (
      noticeBox.contains(document.activeElement) &&
      noticeOpener?.isConnected &&
      !noticeOpener.disabled
    )
      noticeOpener.focus({ preventScroll: true });
    const finish = () => {
      noticeBox.hidden = true;
      noticeBox.classList.remove("is-entering", "is-leaving");
      noticeAnnouncer.textContent = "";
      noticeClosing = false;
    };
    if (noticeMotion.matches) finish();
    else noticeExitTimer = setTimeout(finish, 170);
  }
  function resumeNoticeClock() {
    if (
      !noticeBox ||
      noticeBox.hidden ||
      noticeClosing ||
      noticeHovered ||
      noticeBox.contains(document.activeElement)
    )
      return;
    if (noticeTimer) return;
    if (noticeRemaining <= 0) {
      dismissNotice();
      return;
    }
    noticeStarted = performance.now();
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      noticeRemaining = 0;
      dismissNotice();
    }, noticeRemaining);
    noticeProgress.style.animationPlayState = "running";
  }
  function createNotice() {
    if (noticeBox) return;
    noticeMessage = node("p", { class: "shop-notice-message" });
    noticeAnnouncer = node("p", {
      class: "visually-hidden",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    });
    noticeAction = node("a", { class: "shop-notice-action", hidden: true });
    noticeClose = node(
      "button",
      { class: "shop-notice-close", type: "button", "aria-label": "Закрити повідомлення" },
      node("span", { "aria-hidden": "true", text: "×" }),
    );
    noticeClose.addEventListener("click", dismissNotice);
    noticeIcon = node("span", { class: "shop-notice-icon", "aria-hidden": "true" });
    noticeProgress = node("span", { class: "shop-notice-progress-fill" });
    noticeBox = node(
      "div",
      { id: "shop-notice", class: "shop-notice", hidden: true },
      noticeIcon,
      node("div", { class: "shop-notice-content" }, noticeMessage, noticeAction),
      noticeClose,
      node("span", { class: "shop-notice-progress", "aria-hidden": "true" }, noticeProgress),
    );
    noticeBox.addEventListener("pointerenter", () => {
      noticeHovered = true;
      stopNoticeClock();
    });
    noticeBox.addEventListener("pointerleave", () => {
      noticeHovered = false;
      resumeNoticeClock();
    });
    noticeBox.addEventListener("focusin", stopNoticeClock);
    noticeBox.addEventListener("focusout", () => queueMicrotask(resumeNoticeClock));
    document.body.append(noticeBox, noticeAnnouncer);
  }
  function notify(text, link, kind = "info") {
    createNotice();
    stopNoticeClock();
    clearTimeout(noticeExitTimer);
    if (!noticeBox.contains(document.activeElement)) noticeOpener = document.activeElement;
    const restoreCloseFocus =
      noticeBox.contains(document.activeElement) && document.activeElement === noticeAction;
    const message = String(text ?? "");
    const tone = message.startsWith("Не вдалося")
      ? "error"
      : ["success", "warning", "error", "info"].includes(kind)
        ? kind
        : "info";
    noticeBox.dataset.tone = tone;
    noticeMessage.textContent = message;
    noticeAnnouncer.textContent = message;
    noticeAction.hidden = !link;
    if (link) {
      noticeAction.href = url(link.href);
      noticeAction.textContent = link.text;
    } else {
      noticeAction.removeAttribute("href");
      noticeAction.textContent = "";
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
    }))
      svg.setAttribute(key, value);
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute(
      "d",
      tone === "success"
        ? "m5 12 4 4L19 6"
        : tone === "warning" || tone === "error"
          ? "M12 5v9m0 4h.01"
          : "M12 10v8m0-12h.01",
    );
    svg.append(path);
    noticeIcon.replaceChildren(svg);
    noticeRemaining = 2000;
    noticeClosing = false;
    noticeBox.classList.remove("is-entering", "is-leaving");
    noticeBox.hidden = false;
    // A new message restarts the entrance and lifetime bar, never an old exit callback.
    void noticeBox.offsetWidth;
    noticeBox.classList.add("is-entering");
    window.dispatchEvent(new CustomEvent("coffee:notice"));
    noticeHovered = noticeBox.matches(":hover");
    if (restoreCloseFocus) noticeClose.focus({ preventScroll: true });
    resumeNoticeClock();
  }
  async function addProduct(id, weight = 250, grind = "beans", qty = 1, roast = "raw") {
    if (
      !available(byId.get(id)) ||
      ![250, 500, 1000].includes(weight) ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 99 ||
      !Object.hasOwn(grinds, grind)
    )
      return false;
    const green = isGreen(byId.get(id));
    if (green && roast !== "raw" && !Object.hasOwn(roasts, roast)) return false;
    const candidate = {
      type: "product",
      id,
      weight,
      grind: green && roast === "raw" ? "beans" : grind,
      qty,
      ...(green ? { roast } : {}),
    };
    let ok = true;
    const persisted = await update((s) => {
      const existing = s.cart.find((i) => lineKey(i) === lineKey(candidate));
      if (existing) {
        if (existing.qty + qty > 99) {
          ok = false;
          return false;
        }
        existing.qty += qty;
      } else if (s.cart.length < 50) s.cart.push(candidate);
      else {
        ok = false;
        return false;
      }
    });
    if (!ok) {
      notify("Досягнуто ліміт кількості товарів.");
      return false;
    }
    if (!persisted) {
      notify("Не вдалося зберегти кошик. Дозвольте сховище браузера, щоб перейти між сторінками.");
      return false;
    }
    notify(
      ok ? "Каву додано до кошика." : "Досягнуто ліміт кількості товарів.",
      ok ? { href: "cart.html", text: "Відкрити кошик" } : null,
      ok ? "success" : "warning",
    );
    return ok;
  }
  async function addBean(id, roast = "medium") {
    if (!available(byId.get(id))) { notify("Цей сорт тимчасово недоступний."); return false; }
    let message;
    let added = false;
    const persisted = await update((s) => {
      if (s.draft.beans.some((b) => b.id === id)) {
        message = "Цей сорт уже є у міксі.";
        return false;
      }
      if (s.draft.beans.length === 4) {
        message = "До міксу можна додати до чотирьох сортів.";
        return false;
      }
      s.draft.beans.push({
        id,
        ratio: 0,
        slot: [0, 1, 2, 3].find((slot) => !s.draft.beans.some((bean) => bean.slot === slot)),
        ...(isGreen(byId.get(id))
          ? { roast: Object.hasOwn(roasts, roast) ? roast : "medium" }
          : {}),
      });
      added = true;
      message = "Сорт додано до міксу.";
    });
    if (added && !persisted)
      message =
        "Сорт додано лише на цій сторінці. Браузер не дозволяє зберегти вибір для переходу.";
    if (persisted && added && document.getElementById("mix-form")) return true;
    notify(
      message,
      persisted && added && !document.getElementById("catalog-mix-tray")
        ? { href: "constructor.html", text: "Відкрити конструктор" }
        : null,
      persisted && added ? "success" : "warning",
    );
    return persisted && added;
  }
  async function addMix(m) {
    m = recipe(m);
    if (m.beans.some((b) => !available(byId.get(b.id)))) { notify("Один із сортів недоступний. Замініть його у конструкторі."); return false; }
    if (!validMix(m)) {
      notify("Оберіть зерна та встановіть суму пропорцій 100%.");
      return false;
    }
    let ok = true;
    const persisted = await update((s) => {
      const existing = s.cart.find(
        (i) => i.type === "mix" && mixSignature(i.mix) === mixSignature(m),
      );
      if (existing) {
        if (existing.qty >= 99) {
          ok = false;
          return false;
        } else existing.qty++;
      } else if (s.cart.length < 50) s.cart.push({ type: "mix", mix: { ...m, id: uid() }, qty: 1 });
      else {
        ok = false;
        return false;
      }
    });
    if (!ok) {
      notify("Досягнуто ліміт кількості товарів.");
      return false;
    }
    if (!persisted) {
      notify("Не вдалося зберегти мікс у кошику. Дозвольте сховище браузера та повторіть дію.");
      return false;
    }
    if (ok)
      notify("Мікс додано до кошика.", { href: "cart.html", text: "Відкрити кошик" }, "success");
    return ok;
  }
  window.CoffeeShop = {
    products,
    byId,
    grinds,
    roasts,
    packaging,
    packagingText,
    itemDetails,
    isGreen,
    available,
    brewingMethods,
    beanRoast,
    beanStrength,
    beanFamily,
    root,
    url,
    node,
    money,
    uid,
    mix,
    recipe,
    validMix,
    emptyMix,
    productPrice,
    mixPrice,
    mixTaste,
    tasteDimensions,
    lineKey,
    unit,
    total,
    name,
    composition,
    notify,
    addProduct,
    addBean,
    addMix,
    get: () => copy(state),
    update,
  };
  window.addEventListener("storage", (e) => {
    if ((e.key === key || e.key === null) && storageMode === "local") {
      applyState(latestState(), "external");
    }
  });
  function badges() {
    for (const link of document.querySelectorAll('header a[href$="my-mixes.html"]')) {
      const suffix = state.saved.length ? ` · ${state.saved.length}` : "";
      if (link.textContent !== `Мої мікси${suffix}`) link.textContent = `Мої мікси${suffix}`;
      if (location.pathname.endsWith("/my-mixes.html")) link.setAttribute("aria-current", "page");
    }
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    for (const a of document.querySelectorAll('header a[href$="cart.html"]')) {
      a.setAttribute("aria-label", `Кошик: ${count} товарів`);
      let badge =
        a.querySelector(".cart-count,[data-cart-count]") ||
        [...a.querySelectorAll('span[aria-hidden="true"]')].find((n) =>
          /^\d+$/.test(n.textContent.trim()),
        );
      if (!badge) {
        badge = node("span", { class: "cart-count", "aria-hidden": "true", "data-cart-count": "" });
        a.append(badge);
      }
      badge.textContent = count;
    }
    for (const button of document.querySelectorAll("[data-favorite]")) {
      const active = state.favorites.includes(button.dataset.favorite);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute(
        "aria-label",
        `${active ? "Прибрати" : "Додати"} каву «${byId.get(button.dataset.favorite)?.name || ""}» ${active ? "з обраного" : "до обраного"}`,
      );
      button.classList.toggle("is-favorite", active);
      const icon = button.querySelector("i");
      if (icon) {
        icon.classList.remove("fa-solid");
        icon.classList.add("fa-regular");
      }
    }
  }
  window.addEventListener("coffee:change", badges);
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-favorite],[data-add-bean],[data-buy-product]");
    if (!b || b.disabled || b.getAttribute("aria-disabled") === "true") return;
    if (b.dataset.favorite) {
      const id = b.dataset.favorite;
      if (!byId.has(id)) return;
      const saved = await update((s) => {
        s.favorites = s.favorites.includes(id)
          ? s.favorites.filter((x) => x !== id)
          : [...s.favorites, id];
      });
      if (!saved)
        notify("Не вдалося зберегти обране після переходу. Вибір доступний лише на цій сторінці.");
    }
    if (b.dataset.addBean) await addBean(b.dataset.addBean);
    if (b.dataset.buyProduct && (await addProduct(b.dataset.buyProduct)))
      location.href = url("cart.html");
  });
  // Зв'язуємо готові картки й сторінки товарів зі спільними даними.
  for (const card of document.querySelectorAll('.catalog-product,[data-component="coffee-card"]')) {
    const href = card.querySelector('a[href*="products/"]')?.getAttribute("href");
    const id = href?.split("/").pop().split(".")[0];
    if (!byId.has(id)) continue;
    const favorite = card.querySelector(".product-favorite");
    if (favorite) {
      favorite.disabled = false;
      favorite.dataset.favorite = id;
    }
    const mixButton = [...card.querySelectorAll("button")].find((b) =>
      /Додати до міксу/.test(b.textContent),
    );
    if (mixButton) {
      mixButton.disabled = false;
      mixButton.dataset.addBean = id;
      mixButton.removeAttribute("aria-describedby");
    }
  }
  const purchase = document.querySelector("#product-purchase");
  if (purchase) {
    const id = location.pathname.split("/").pop().replace(".html", ""),
      p = byId.get(id);
    if (p) {
      purchase
        .querySelectorAll("fieldset[disabled],button[disabled]")
        .forEach((e) => (e.disabled = false));
      const status = document.getElementById("product-purchase-status");
      status.textContent = isGreen(p)
        ? "Оберіть зелене зерно або обсмаження без доплати. Помел доступний для обсмаженого зерна. Ціни й характеристики демонстраційні."
        : "Оберіть вагу та помел. Купівля додає каву до кошика.";
      status.classList.remove("visually-hidden");
      const grindSelect = node(
        "select",
        { id: "product-grind", name: "grind" },
        Object.entries(grinds).map(([value, text]) => node("option", { value, text })),
      );
      const grindField = node(
        "div",
        { class: "shop-purchase-option" },
        node("label", { for: "product-grind", text: "Помел" }),
        grindSelect,
      );
      purchase.querySelector(".product-weight").after(grindField);
      let roastSelect;
      if (isGreen(p)) {
        roastSelect = node(
          "select",
          { id: "product-roast", name: "roast" },
          node("option", { value: "raw", text: "Без обсмаження · зелене зерно" }),
          Object.entries(roasts).map(([value, text]) =>
            node("option", { value, text: `${text} · без доплати` }),
          ),
        );
        grindField.before(
          node(
            "div",
            { class: "shop-purchase-option" },
            node("label", { for: "product-roast", text: "Обсмаження" }),
            roastSelect,
          ),
        );
        grindSelect.disabled = true;
        roastSelect.addEventListener("change", () => {
          grindSelect.disabled = roastSelect.value === "raw";
          if (grindSelect.disabled) grindSelect.value = "beans";
        });
      }
      const buttons = purchase.querySelectorAll(".product-purchase-actions button");
      const weight = () => Number(purchase.querySelector('[name="weight"]:checked')?.value) || 250;
      const price = () =>
        purchase
          .querySelector(".product-detail-price")
          .replaceChildren(
            node("span", { class: "visually-hidden", text: `Ціна за ${weight()} г: ` }),
            money(productPrice(p, weight())),
          );
      purchase.addEventListener("change", price);
      price();
      purchase.addEventListener("submit", (e) => e.preventDefault());
      if (!available(p)) { buttons.forEach((b) => { b.disabled = true; }); status.textContent = "Цей сорт тимчасово недоступний. Оберіть інший у каталозі."; }
      buttons[0].addEventListener("click", async () => {
        if (await addProduct(id, weight(), grindSelect.value, 1, roastSelect?.value || "raw"))
          location.href = url("cart.html");
      });
      buttons[1].addEventListener("click", () => addBean(id, roastSelect?.value || "medium"));
    }
  }
  document
    .querySelector("#mix-action-note")
    ?.replaceChildren("Додавайте сорти до міксу, а вагу й пропорції налаштовуйте у конструкторі.");
  const catalogFooterLink = document.querySelector('footer a[href$="catalog.html"]');
  if (catalogFooterLink?.closest("ul") && !catalogFooterLink.closest("ul").querySelector('a[href$="my-mixes.html"]')) {
    catalogFooterLink.closest("ul").append(
      node(
        "li",
        {},
        node("a", {
          class: catalogFooterLink.className,
          href: url("my-mixes.html"),
          text: "Мої мікси",
        }),
      ),
    );
  }
  for (const link of document.querySelectorAll('a[href$="quiz.html"]')) {
    for (const child of link.childNodes) {
      if (child.nodeType === Node.TEXT_NODE)
        child.textContent = child.textContent.replace(/Quiz/g, "Квіз");
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document.querySelectorAll("header details[open]").forEach((d) => {
        d.open = false;
        d.querySelector("summary")?.focus();
      });
  });
  createNotice();
  badges();
  storageNotice();
})();
