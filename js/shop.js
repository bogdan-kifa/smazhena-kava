/* Спільні дані браузерного прототипу. Жодні персональні дані чи платежі не зберігаються. */
(() => {
  "use strict";
  const root = new URL("../", document.currentScript.src);
  const products = window.COFFEE_PRODUCTS;
  const byId = new Map(products.map((p) => [p.id, p]));
  const key = "smazhena-kava:shop:v1";
  const weights = [100, 200, 250, 500, 1000, 2000];
  const grinds = { beans: "У зернах", espresso: "Еспресо", filter: "Фільтр", cezve: "Джезва" };
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
  function mix(value) {
    if (!value || typeof value !== "object") return emptyMix();
    const seen = new Set();
    const beans = (Array.isArray(value.beans) ? value.beans : [])
      .filter((b) => b && byId.has(b.id) && !seen.has(b.id) && seen.add(b.id))
      .slice(0, 4)
      .map((b) => ({ id: b.id, ratio: integer(b.ratio, 0, 100, 0) }));
    return {
      id: typeof value.id === "string" && /^[\w-]{1,80}$/.test(value.id) ? value.id : "",
      name:
        typeof value.name === "string" ? value.name.trim().slice(0, 60) || "Мій мікс" : "Мій мікс",
      beans,
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
      [...m.beans].sort((a, b) => a.id.localeCompare(b.id)),
      m.weight,
      m.grind,
      m.packaging,
    ]);
  }
  function demoOrder(value) {
    if (!value || !/^DEMO-[A-Z0-9-]{8}$/.test(value.id) || !Array.isArray(value.items)) return null;
    if (!value.items.length || value.items.length > 50 || !isoDate(value.created)) return null;
    const items = value.items;
    if (
      !items.every(
        (i) =>
          i &&
          typeof i.name === "string" &&
          i.name.length <= 100 &&
          Number.isInteger(i.weight) &&
          weights.includes(i.weight) &&
          Number.isInteger(i.qty) &&
          i.qty >= 1 &&
          i.qty <= 99 &&
          Number.isSafeInteger(i.total) &&
          i.total >= 0,
      )
    )
      return null;
    const total = items.reduce((sum, i) => sum + i.total, 0);
    if (!Number.isSafeInteger(total) || total !== value.total) return null;
    return {
      id: value.id,
      items: items.map(({ name, weight, qty, total }) => ({ name, weight, qty, total })),
      total,
      delivery: value.delivery === "courier" ? "courier" : "post",
      created: isoDate(value.created),
    };
  }
  function normalize(v = {}) {
    if (!v || typeof v !== "object") v = {};
    const cart = [];
    for (const item of (Array.isArray(v.cart) ? v.cart : []).slice(0, 50)) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "product" && byId.has(item.id) && [250, 500, 1000].includes(item.weight)) {
        const grind = Object.hasOwn(grinds, item.grind) ? item.grind : "beans";
        const entry = {
          type: "product",
          id: item.id,
          weight: item.weight,
          grind,
          qty: integer(item.qty, 1, 99, 1),
        };
        const existing = cart.find(
          (x) =>
            x.type === "product" &&
            x.id === entry.id &&
            x.weight === entry.weight &&
            x.grind === entry.grind,
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
      lastOrder: demoOrder(v.lastOrder),
    };
  }
  const sessionKey = `${key}:session`;
  let sharedWrites = typeof navigator.locks?.request === "function";
  let storageMode = sharedWrites ? "local" : "session";
  const volatileKeys = new Set();
  const stateFields = ["cart", "favorites", "draft", "saved", "quiz", "lastOrder"];
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
  function finishOrder({ delivery, expectedCart }) {
    return withStateLock(() => {
      const current = latestState();
      applyState(current, "external");
      if (!current.cart.length) return { ok: false, reason: "empty" };
      if (JSON.stringify(current.cart) !== JSON.stringify(expectedCart))
        return { ok: false, reason: "changed" };
      const order = {
        id: "DEMO-" + uid().slice(0, 8).toUpperCase(),
        items: current.cart.map((item) => ({
          name: name(item),
          weight: item.type === "product" ? item.weight : item.mix.weight,
          qty: item.qty,
          total: unit(item) * item.qty,
        })),
        total: current.cart.reduce((sum, item) => sum + unit(item) * item.qty, 0),
        delivery,
        created: new Date().toISOString(),
      };
      const next = normalize({ ...current, cart: [], lastOrder: order });
      if (!persist(next)) {
        applyState(current, "external");
        return { ok: false, reason: "cart-storage" };
      }
      applyState(next, "local");
      return { ok: true, order: next.lastOrder };
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
    }).format(cents / 100);
  const productPrice = (p, weight = 250) => Math.round((p.price * weight) / 250);
  const mixPrice = (m) =>
    Math.round(
      (m.beans.reduce((s, b) => s + (byId.get(b.id).price * b.ratio) / 100, 0) * m.weight) / 250,
    );
  const lineKey = (item) =>
    item.type === "product" ? `p:${item.id}:${item.weight}:${item.grind}` : `m:${item.mix.id}`;
  const unit = (item) =>
    item.type === "product" ? productPrice(byId.get(item.id), item.weight) : mixPrice(item.mix);
  const total = () => state.cart.reduce((s, i) => s + unit(i) * i.qty, 0);
  const name = (item) => (item.type === "product" ? byId.get(item.id).name : item.mix.name);
  const composition = (m) => m.beans.map((b) => `${byId.get(b.id).name} ${b.ratio}%`).join(" · ");
  let noticeTimer;
  function notify(text, link) {
    let box = document.getElementById("shop-notice");
    if (!box) {
      box = node("div", {
        id: "shop-notice",
        class: "shop-notice",
        role: "status",
        "aria-live": "polite",
      });
      document.body.append(box);
    }
    box.replaceChildren(node("span", { text }));
    if (link) box.append(node("a", { href: url(link.href), text: link.text }));
    box.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      if (!box.contains(document.activeElement)) box.hidden = true;
    }, 6500);
  }
  async function addProduct(id, weight = 250, grind = "beans", qty = 1) {
    if (
      !byId.has(id) ||
      ![250, 500, 1000].includes(weight) ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 99 ||
      !Object.hasOwn(grinds, grind)
    )
      return false;
    const candidate = { type: "product", id, weight, grind, qty };
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
    );
    return ok;
  }
  async function addBean(id) {
    if (!byId.has(id)) return false;
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
      s.draft.beans.push({ id, ratio: 0 });
      added = true;
      message = "Сорт додано до міксу.";
    });
    if (added && !persisted)
      message =
        "Сорт додано лише на цій сторінці. Браузер не дозволяє зберегти вибір для переходу.";
    notify(
      message,
      persisted && added ? { href: "constructor.html", text: "Відкрити конструктор" } : null,
    );
    return persisted && added;
  }
  async function addMix(m) {
    m = recipe(m);
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
    if (ok) notify("Мікс додано до кошика.", { href: "cart.html", text: "Відкрити кошик" });
    return ok;
  }
  window.CoffeeShop = {
    products,
    byId,
    grinds,
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
    finishOrder,
  };
  window.addEventListener("storage", (e) => {
    if ((e.key === key || e.key === null) && storageMode === "local") {
      applyState(latestState(), "external");
    }
  });
  function badges() {
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
    if (!b || b.disabled) return;
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
      status.textContent = "Оберіть вагу. Купівля додає каву до локального кошика, без оплати.";
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
      buttons[0].addEventListener("click", async () => {
        if (await addProduct(id, weight())) location.href = url("cart.html");
      });
      buttons[1].addEventListener("click", () => addBean(id));
    }
  }
  document
    .querySelector("#mix-action-note")
    ?.replaceChildren("Додавайте сорти до міксу, а вагу й пропорції налаштовуйте у конструкторі.");
  const catalogFooterLink = document.querySelector('footer a[href$="catalog.html"]');
  if (catalogFooterLink?.closest("ul")) {
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
  // Швидкі переходи до локальних рецептів та обраного без імітації акаунта.
  for (const nav of document.querySelectorAll("header details nav ul")) {
    nav.append(
      node(
        "li",
        {},
        node("a", { class: "shop-nav-link", href: url("my-mixes.html"), text: "Мої мікси" }),
      ),
    );
  }
  if (document.querySelector(".login-form")) {
    document.querySelector(".login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      notify("Серверну авторизацію ще не підключено.");
    });
    document.querySelector(".login-description").textContent =
      "Вхід до акаунта ще недоступний. Рецепти вже можна зберігати в цьому браузері.";
    document.querySelector(".login-form").before(
      node(
        "div",
        { class: "shop-empty" },
        node("p", {
          text: "Вхід і реєстрація ще недоступні. Зберігати мікси в цьому браузері можна без акаунта.",
        }),
        node("a", {
          class: "button button-secondary",
          href: url("my-mixes.html"),
          text: "Відкрити мої мікси",
        }),
      ),
    );
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document.querySelectorAll("header details[open]").forEach((d) => {
        d.open = false;
        d.querySelector("summary")?.focus();
      });
  });
  badges();
  storageNotice();
})();
