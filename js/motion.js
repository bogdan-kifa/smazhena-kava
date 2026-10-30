/* Optional presentation only. Existing shop/carousel/notice scripts own all business state. */
(() => {
  "use strict";
  const config = Object.assign(
    {
      hero: true,
      tilt: true,
      reveal: true,
      header: true,
      cards: true,
      fly: true,
      drag: true,
      top: true,
    },
    window.CoffeeMotionConfig,
  );
  for (const key of (document.body.dataset.moDisable || "").split(/\s+/))
    if (key) config[key] = false;
  const media = matchMedia("(prefers-reduced-motion: no-preference)"),
    fine = matchMedia("(hover: hover) and (pointer: fine)");
  const canMove = () => media.matches,
    S = window.CoffeeShop;
  const n = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };
  document.body.classList.add("mo-ready");
  window.CoffeeMotion = Object.freeze({ config: Object.freeze(config) });
  const header = document.querySelector('header.site-header,header[data-component="header"]');
  let brand, cta;
  if (config.header && header) {
    const inner = header.firstElementChild,
      nav = header.querySelector("nav:not(details nav)"),
      menu = header.querySelector("details"),
      cart = header.querySelector('a[href$="cart.html"]'),
      account = header.querySelector('a[href$="login.html"]');
    brand = header.querySelector('a[href$="index.html"]');
    cta = [...header.querySelectorAll('a[href$="constructor.html"]')].find(
      (a) => !a.closest("details"),
    );
    header.classList.add("mo-header");
    inner.classList.add("mo-header-inner");
    brand?.classList.add("mo-brand");
    nav?.classList.add("mo-nav");
    const tools = header.querySelector(".header-actions") || cart?.parentElement;
    tools?.classList.add("mo-tools");
    account?.classList.add("mo-account");
    cta?.classList.add("mo-cta");
    if (cart) {
      cart.classList.add("mo-cart");
      const icon = n("i", {
        class: "fa-solid fa-bag-shopping icon mo-cart-icon",
        "aria-hidden": "true",
      });
      const previousIcon = cart.querySelector("svg, .fa-bag-shopping");
      if (previousIcon) previousIcon.replaceWith(icon);
      else cart.prepend(icon);
      const caption = n("span", { class: "mo-cart-caption", text: "Кошик" });
      if (!cart.querySelector(".mo-cart-caption")) cart.prepend(caption);
    }
    for (const a of header.querySelectorAll("nav a[href]")) {
      a.classList.add("mo-nav-link");
      const dest = new URL(a.href).pathname.split("/").pop(),
        current = location.pathname.split("/").pop() || "index.html";
      if (dest === "catalog.html") a.textContent = "Каталог";
      if (dest === "quiz.html") a.textContent = "Квіз-підбір";
      if (dest === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    if (menu) {
      const mixItem = menu.querySelector('nav a[href$="constructor.html"]')?.closest("li");
      if (mixItem) mixItem.parentElement.prepend(mixItem);
      menu.classList.add("mo-menu");
      menu.querySelector("summary")?.classList.add("mo-menu-toggle");
      menu.querySelector("nav")?.classList.add("mo-menu-panel");
      menu.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          menu.open = false;
          menu.querySelector("summary").focus();
        }
      });
      document.addEventListener("click", (e) => {
        if (menu.open && !menu.contains(e.target)) menu.open = false;
      });
      matchMedia("(min-width:1101px)").addEventListener("change", (e) => {
        if (e.matches) menu.open = false;
      });
    }
    // The header scrolls with the document; sticky catalogue tools need no header offset.
    document.documentElement.style.setProperty("--mo-header-height", "0px");
  }
  const hero = document.getElementById("hero"),
    video = document.getElementById("hero-video");
  if (config.hero && hero) {
    const copy = hero.querySelector("h1")?.parentElement;
    [...(copy?.children || [])].forEach((el, index) => {
      el.classList.add("mo-hero-line");
      el.style.setProperty("--mo-delay", `${index * 85}ms`);
    });
  }
  if (config.tilt && video) {
    const panel = video.parentElement;
    panel.classList.add("mo-tilt");
    let frame = 0;
    const reset = () => {
      panel.style.setProperty("--mo-tilt-x", "0deg");
      panel.style.setProperty("--mo-tilt-y", "0deg");
    };
    panel.addEventListener("pointermove", (e) => {
      if (!canMove() || !fine.matches || e.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty(
          "--mo-tilt-x",
          `${(-(e.clientY - r.top - r.height / 2) / r.height) * 4}deg`,
        );
        panel.style.setProperty(
          "--mo-tilt-y",
          `${((e.clientX - r.left - r.width / 2) / r.width) * 4}deg`,
        );
      });
    });
    panel.addEventListener("pointerleave", reset);
    media.addEventListener("change", reset);
  }
  const seen = new WeakSet(),
    decorated = new WeakSet();
  const observer =
    config.reveal && "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                entry.target.classList.add("mo-shown");
                observer.unobserve(entry.target);
                setTimeout(() => entry.target.classList.remove("mo-reveal", "mo-shown"), 1000);
              }
          },
          { threshold: 0.05, rootMargin: "0px 0px 35px 0px" },
        )
      : null;
  const decorate = () => {
    if (config.cards)
      for (const card of document.querySelectorAll(
        ".product-card,.catalog-product,.home-reason-card,#reviews figure,.saved-mix-card",
      )) {
        if (decorated.has(card)) continue;
        decorated.add(card);
        card.classList.add("mo-hover");
        card
          .querySelectorAll(".product-badge,.catalog-photo-caption")
          .forEach((b) => b.classList.add("mo-badge"));
      }
    if (observer)
      for (const el of document.querySelectorAll(
        "main > section:not(#hero),main > .container > section,.catalog-product,#reviews figure,.home-reason-card",
      )) {
        if (
          seen.has(el) ||
          el.closest("form,.mix-summary,dialog,[hidden]") ||
          el.querySelector("#catalog-mix-tray,#mix-form")
        )
          continue;
        seen.add(el);
        if (!canMove() || el.getBoundingClientRect().bottom < 0) continue;
        const siblings = [...(el.parentElement?.children || [])],
          index = siblings.indexOf(el);
        el.style.setProperty("--mo-delay", `${Math.min(index, 3) * 65}ms`);
        el.classList.add("mo-reveal");
        observer.observe(el);
      }
  };
  let decorateFrame = 0;
  const main = document.querySelector("main");
  if (main)
    new MutationObserver((records) => {
      if (
        records.some(
          (r) => r.type === "childList" && [...r.addedNodes].some((n) => n.nodeType === 1),
        )
      ) {
        cancelAnimationFrame(decorateFrame);
        decorateFrame = requestAnimationFrame(decorate);
      }
    }).observe(main, { childList: true, subtree: true });
  document.addEventListener("focusin", (e) => {
    for (let el = e.target; el; el = el.parentElement)
      if (el.classList?.contains("mo-reveal")) {
        el.classList.remove("mo-reveal", "mo-shown");
        observer?.unobserve(el);
      }
  });
  media.addEventListener("change", () => {
    if (!canMove())
      document.querySelectorAll(".mo-reveal").forEach((el) => {
        el.classList.remove("mo-reveal", "mo-shown");
        observer?.unobserve(el);
      });
  });
  decorate();
  const flying = new Set();
  let pending = null;
  if (config.fly && S) {
    document.addEventListener(
      "click",
      (e) => {
        pending = null;
        const button = e.target.closest("[data-add-bean]");
        if (
          !button ||
          button.closest("#mix-form") ||
          button.disabled ||
          button.getAttribute("aria-disabled") === "true" ||
          !canMove()
        )
          return;
        const id = button.dataset.addBean;
        if (S.get().draft.beans.some((b) => b.id === id)) return;
        const rect = button.getBoundingClientRect();
        pending = {
          id,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          time: performance.now(),
        };
      },
      true,
    );
    window.addEventListener("coffee:notice", () => {
      const request = pending;
      pending = null;
      const notice = document.getElementById("shop-notice");
      if (
        !request ||
        !canMove() ||
        performance.now() - request.time > 2500 ||
        notice?.dataset.tone !== "success" ||
        !notice
          .querySelector(".shop-notice-message")
          ?.textContent.startsWith("Сорт додано до міксу")
      )
        return;
      const bean = S.get().draft.beans.find((b) => b.id === request.id);
      if (!bean) return;
      let target =
        document.querySelector(`#catalog-tray-slots [data-color="${bean.slot}"]`) ||
        cta ||
        header?.querySelector('a[href$="constructor.html"]');
      if (!target) return;
      let rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > innerHeight) {
        target = cta || header?.querySelector('a[href$="constructor.html"]');
        if (!target) return;
        rect = target.getBoundingClientRect();
      }
      const marker = n("span", { class: "mo-flying-bean", "aria-hidden": "true" });
      marker.innerHTML =
        '<svg viewBox="0 0 24 30" fill="currentColor"><ellipse cx="12" cy="15" rx="9" ry="14" transform="rotate(28 12 15)"/><path d="M17 3C7 10 17 18 7 27" fill="none" stroke="var(--color-background-light)" stroke-width="1.6"/></svg>';
      marker.style.left = `${request.x - 12}px`;
      marker.style.top = `${request.y - 15}px`;
      document.body.append(marker);
      flying.add(marker);
      const dx = rect.left + rect.width / 2 - request.x,
        dy = rect.top + rect.height / 2 - request.y;
      const animation = marker.animate(
        [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx * 0.5}px,${dy * 0.5 - 70}px) rotate(100deg) scale(.85)`,
            opacity: 1,
            offset: 0.5,
          },
          { transform: `translate(${dx}px,${dy}px) rotate(180deg) scale(.35)`, opacity: 0 },
        ],
        { duration: 650, easing: "ease-in-out" },
      );
      animation.finished
        .catch(() => {})
        .finally(() => {
          marker.remove();
          flying.delete(marker);
        });
    });
    media.addEventListener("change", () => {
      if (!canMove())
        for (const marker of flying) {
          marker.getAnimations().forEach((a) => a.cancel());
          marker.remove();
        }
    });
  }
  const dragLists = new WeakSet();
  function addDragging() {
    if (!config.drag) return;
    for (const list of document.querySelectorAll(".shop-carousel")) {
      if (dragLists.has(list)) continue;
      dragLists.add(list);
      list.classList.add("mo-draggable");
      let gesture = null,
        suppress = false;
      list.addEventListener("pointerdown", (e) => {
        if (
          e.pointerType !== "mouse" ||
          e.button !== 0 ||
          e.target.closest("button,input,select,textarea")
        )
          return;
        gesture = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          left: list.scrollLeft,
          moved: false,
        };
      });
      list.addEventListener("pointermove", (e) => {
        if (!gesture || gesture.id !== e.pointerId) return;
        const dx = e.clientX - gesture.x;
        if (!gesture.moved) {
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - gesture.y)) return;
          gesture.moved = true;
          list.classList.add("mo-dragging");
          list.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
        list.scrollLeft = gesture.left - dx;
      });
      const end = () => {
        if (!gesture) return;
        suppress = gesture.moved;
        if (list.hasPointerCapture(gesture.id)) list.releasePointerCapture(gesture.id);
        list.classList.remove("mo-dragging");
        gesture = null;
        setTimeout(() => (suppress = false), 100);
      };
      list.addEventListener("pointerup", end);
      list.addEventListener("pointercancel", end);
      list.addEventListener("lostpointercapture", end);
      list.addEventListener(
        "click",
        (e) => {
          if (suppress) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true,
      );
      list.addEventListener("dragstart", (e) => e.preventDefault());
    }
  }
  addDragging();
  let top;
  if (config.top) {
    top = n(
      "button",
      { class: "mo-top", type: "button", "aria-label": "Нагору", hidden: "" },
      n("span", { "aria-hidden": "true", class: "mo-top-arrow", text: "↑" }),
      n("span", { "aria-hidden": "true", class: "mo-top-percent", text: "0%" }),
      n(
        "span",
        { "aria-hidden": "true", class: "mo-top-meter" },
        n("span", { class: "mo-top-fill" }),
      ),
    );
    document.body.append(top);
    top.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: canMove() ? "smooth" : "instant" });
      (brand || header?.querySelector("a") || document.querySelector("main"))?.focus({
        preventScroll: true,
      });
    });
  }
  let scrollFrame = 0;
  function onScroll() {
    scrollFrame = 0;
    if (top) {
      const maximum = document.documentElement.scrollHeight - innerHeight,
        progress = maximum > 0 ? Math.min(1, Math.max(0, scrollY / maximum)) : 0;
      top.hidden = scrollY < 400;
      top.style.setProperty("--mo-progress", String(progress));
      top.querySelector(".mo-top-percent").textContent = `${Math.round(progress * 100)}%`;
    }
  }
  addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(onScroll);
    },
    { passive: true },
  );
  addEventListener("resize", onScroll);
  onScroll();
})();
