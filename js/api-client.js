/* Same-origin API client: the browser never stores a password or session token. */
(() => {
  "use strict";
  const root = new URL("../", document.currentScript.src);
  let current = null;
  async function request(path, options = {}) {
    if (window.CoffeeSite?.demo) return window.CoffeeDemo.request(path, options);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(new URL("api/" + path.replace(/^\//, ""), root), {
        method: options.method || "GET",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          "X-SK-Request": "1",
          ...options.headers,
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const e = new Error(data?.error || "Сервіс недоступний. Спробуйте ще раз.");
        e.status = response.status;
        e.code = data?.code;
        throw e;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не відповів вчасно. Спробуйте ще раз.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  const update = (user) => {
    current = user;
    for (const badge of document.querySelectorAll("[data-mix-count]")) {
      const known = Boolean(user) && Number.isSafeInteger(user.mixCount) && user.mixCount >= 0;
      badge.hidden = !known;
      badge.textContent = known ? String(user.mixCount) : "";
    }
    dispatchEvent(new CustomEvent("coffee:account", { detail: { user } }));
    return user;
  };
  const API = {
    request,
    get currentUser() {
      return current;
    },
    async getUser() {
      return update((await request("auth/me")).user);
    },
    async login(body) {
      return update((await request("auth/login", { method: "POST", body })).user);
    },
    async register(body) {
      return update((await request("auth/register", { method: "POST", body })).user);
    },
    async logout() {
      await request("auth/logout", { method: "POST", body: {} });
      update(null);
    },
    async saveMix(body) {
      const { id, ...payload } = body;
      const mix = (await request(id ? "mixes/" + encodeURIComponent(id) : "mixes", { method: id ? "PATCH" : "POST", body: payload })).mix;
      await API.getUser().catch(() => {});
      return mix;
    },
  };
  window.CoffeeAPI = Object.freeze(API);
  if (window.CoffeeAccount)
    window.CoffeeAccount.configureClient({ getUser: API.getUser, saveMix: API.saveMix });
  function accountLinks(user) {
    for (const link of document.querySelectorAll(
      'header a[href$="login.html"],header a[data-account-link]',
    )) {
      link.dataset.accountLink = "";
      link.href = new URL(user ? "profile.html" : "login.html", root).href;
      const label = user ? "Кабінет" : "Акаунт";
      link.setAttribute("aria-label", label);
      if (!link.closest("details")) {
        link.classList.add("mo-account", "mo-account-link");
        let icon = link.querySelector("svg.mo-account-icon");
        if (!icon) {
          icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          for (const [key, value] of Object.entries({
            class: "mo-account-icon",
            width: 18,
            height: 18,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.75,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "aria-hidden": "true",
            focusable: "false",
          }))
            icon.setAttribute(key, value);
          const circle = document.createElementNS(icon.namespaceURI, "circle");
          for (const [key, value] of Object.entries({ cx: 12, cy: 8, r: 3 }))
            circle.setAttribute(key, value);
          const path = document.createElementNS(icon.namespaceURI, "path");
          path.setAttribute("d", "M5 21v-2a7 7 0 0 1 14 0v2");
          icon.append(circle, path);
        }
        const text = document.createElement("span");
        text.textContent = label;
        link.replaceChildren(icon, text);
      } else link.textContent = label;
      if (
        user &&
        ["profile.html", "orders.html", "my-mixes.html"].includes(
          location.pathname.split("/").pop(),
        )
      )
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }
  addEventListener("coffee:account", (event) => accountLinks(event.detail.user));
  addEventListener("pageshow", (event) => {
    if (event.persisted) API.getUser().catch(() => {});
  });
  API.getUser().catch(() => {});
})();
