(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S,
    list = document.querySelector(".cart-items");
  if (!list) return;
  const status = document.getElementById("cart-status");
  if (status) {
    status.textContent =
      "Кошик зберігається у цьому браузері. Змінюйте кількість або видаляйте товари.";
    status.classList.remove("visually-hidden");
  }
  const focusControl = (control) => {
    if (!control) return;
    const controls = [...list.querySelectorAll("[data-control]")];
    const target = controls.find((x) => x.dataset.control === control && !x.disabled);
    const fallback = controls.find(
      (x) => x.dataset.control === control.replace(/:(minus|plus)$/, ":input"),
    );
    (target || fallback)?.focus({ preventScroll: true });
  };
  const itemCount = (count) => {
    const last = count % 10,
      lastTwo = count % 100;
    const noun =
      last === 1 && lastTwo !== 11
        ? "товар"
        : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
          ? "товари"
          : "товарів";
    return `${count} ${noun}`;
  };
  function render() {
    const oldFocus = document.activeElement?.dataset.control,
      state = S.get();
    document.querySelector(".cart-heading .catalog-intro").textContent = itemCount(
      state.cart.reduce((sum, item) => sum + item.qty, 0),
    );
    list.replaceChildren();
    if (!state.cart.length)
      list.append(
        n(
          "li",
          { class: "shop-empty" },
          n("p", { text: "Кошик поки порожній." }),
          n("a", { class: "button", href: S.url("catalog.html"), text: "Обрати каву" }),
        ),
      );
    state.cart.forEach((item, index) => {
      const id = S.lineKey(item),
        name = S.name(item),
        product = item.type === "product" ? S.byId.get(item.id) : S.byId.get(item.mix.beans[0].id);
      const path = item.type === "product" ? `products/${item.id}.html` : "constructor.html";
      const change = async (qty, delta = null) => {
        if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
          S.notify("Кількість має бути цілим числом від 1 до 99.");
          render();
          return;
        }
        const control = document.activeElement?.dataset.control;
        const persisted = await S.update((s) => {
          const current = s.cart.find((x) => S.lineKey(x) === id);
          if (!current) return false;
          current.qty = delta === null ? qty : Math.max(1, Math.min(99, current.qty + delta));
        });
        if (!persisted) {
          render();
          S.notify("Не вдалося змінити кількість. Перевірте кошик і дозвіл на збереження даних.");
        }
        focusControl(control);
      };
      const input = n("input", {
        class: "cart-quantity-input",
        id: `cart-qty-${index}`,
        type: "number",
        min: 1,
        max: 99,
        step: 1,
        value: item.qty,
        "data-control": id + ":input",
        "aria-label": `Кількість: ${name}`,
      });
      input.addEventListener("change", async () => await change(Number(input.value)));
      const minus = n("button", {
        class: "cart-quantity-button",
        type: "button",
        disabled: item.qty === 1,
        "data-control": id + ":minus",
        "aria-label": `Зменшити кількість: ${name}`,
        text: "−",
      });
      minus.addEventListener("click", async () => await change(item.qty - 1, -1));
      const plus = n("button", {
        class: "cart-quantity-button",
        type: "button",
        disabled: item.qty === 99,
        "data-control": id + ":plus",
        "aria-label": `Збільшити кількість: ${name}`,
        text: "+",
      });
      plus.addEventListener("click", async () => await change(item.qty + 1, 1));
      const remove = n("button", {
        class: "cart-remove",
        type: "button",
        "data-control": id + ":remove",
        "aria-label": `Видалити ${name} з кошика`,
        text: "Видалити",
      });
      remove.addEventListener("click", async () => {
        const nextItem = state.cart[index + 1] || state.cart[index - 1];
        const persisted = await S.update((s) => {
          s.cart = s.cart.filter((x) => S.lineKey(x) !== id);
        });
        if (!persisted) {
          render();
          focusControl(id + ":remove");
          S.notify("Не вдалося зберегти видалення. Товар залишився в кошику.");
          return;
        }
        if (nextItem) focusControl(S.lineKey(nextItem) + ":remove");
        else list.querySelector("a")?.focus({ preventScroll: true });
        S.notify("Товар видалено з кошика.");
      });
      const photo = n(
        "a",
        { class: "cart-item-photo", href: S.url(path), "aria-label": `${name} — детальніше` },
        n("img", {
          src: S.url(product.image),
          alt: "Кавові зерна",
          width: 1536,
          height: 1024,
          loading: "lazy",
        }),
      );
      const info = n(
        "div",
        { class: "cart-item-copy" },
        n(
          "h3",
          { class: "cart-item-title", id: `cart-title-${index}` },
          n("a", { href: S.url(path), text: name }),
        ),
        n("p", {
          class: "muted",
          text:
            item.type === "product"
              ? `${item.weight} г · ${S.grinds[item.grind]}`
              : `${item.mix.weight} г · ${S.composition(item.mix)} · ${S.grinds[item.mix.grind]}`,
        }),
        n(
          "div",
          { class: "cart-quantity", role: "group", "aria-label": `Кількість: ${name}` },
          minus,
          input,
          plus,
        ),
      );
      if (item.type === "mix") {
        for (const link of [photo, info.querySelector("a")])
          link.addEventListener("click", async (event) => {
            event.preventDefault();
            const persisted = await S.update((state) => {
              state.draft = item.mix;
            });
            if (persisted) location.href = S.url("constructor.html");
            else S.notify("Не вдалося відкрити рецепт. Дозвольте збереження даних браузера.");
          });
      }
      const prices = n(
        "div",
        { class: "cart-item-price" },
        n("p", { class: "cart-line-price", text: S.money(S.unit(item) * item.qty) }),
        remove,
      );
      list.append(
        n(
          "li",
          {},
          n(
            "article",
            { class: "cart-item", "aria-labelledby": `cart-title-${index}` },
            photo,
            info,
            prices,
          ),
        ),
      );
    });
    const total = S.total(),
      delivery = total >= 80000;
    document.querySelector(".cart-summary-total > span").textContent = "Разом за товари";
    document.querySelector(".cart-total-price").textContent = S.money(total);
    const dd = document.querySelectorAll(".cart-summary-lines dd");
    dd[0].textContent = S.money(total);
    dd[1].textContent = delivery ? "Безкоштовно" : "За тарифом перевізника";
    document.getElementById("cart-delivery-label").textContent = delivery
      ? "Безкоштовна доставка доступна"
      : `До безкоштовної доставки ще ${S.money(80000 - total)}`;
    document.querySelector(".cart-delivery-progress").value = Math.min(total / 100, 800);
    const checkout = document.querySelector('.cart-summary-actions a[href$="checkout.html"]');
    if (checkout) {
      checkout.hidden = !state.cart.length;
      checkout.setAttribute("aria-disabled", String(!state.cart.length));
    }
    focusControl(oldFocus);
  }
  window.addEventListener("coffee:change", render);
  render();
})();
