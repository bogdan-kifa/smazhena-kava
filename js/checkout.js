(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S;
  const form = document.getElementById("checkout-form");
  if (form) {
    // Власні підказки розташовані біля полів; значення перевіряємо до демооформлення.
    form.noValidate = true;
    let submitting = false,
      renderedCart = [];
    const button = document.querySelector('[data-action="confirm-order"]');
    const submitMessage = document.getElementById("checkout-submit-message");
    button.textContent = "Створити демозамовлення";
    const status = document.getElementById("checkout-status");
    status.textContent =
      "Це навчальна демонстрація. Контактні дані не надсилаються і не зберігаються. Реальні замовлення й оплата ще недоступні.";
    status.classList.remove("visually-hidden");
    form
      .querySelectorAll("fieldset[disabled],input[disabled]")
      .forEach((x) => (x.disabled = false));
    document.getElementById("guest-checkout").disabled = true;
    // Онлайн-еквайринг навмисно не імітується: доступне лише демонстраційне оформлення.
    const card = document.getElementById("payment-card"),
      receipt = document.getElementById("payment-receipt");
    card.disabled = true;
    card.checked = false;
    receipt.checked = true;
    const paymentLabel = form.querySelector('[for="payment-card"]');
    paymentLabel.textContent = "Картка онлайн — буде пізніше";
    document.querySelector(".checkout-order-total > span").textContent = "Разом за товари";
    function itemLink(item) {
      const link = n("a", {
        href: S.url(item.type === "product" ? `products/${item.id}.html` : "constructor.html"),
        text: `${S.name(item)} · ${item.type === "product" ? item.weight : item.mix.weight} г × ${item.qty} · ${S.itemDetails(item)}`,
      });
      if (item.type === "mix")
        link.addEventListener("click", async (event) => {
          event.preventDefault();
          const saved = await S.update((state) => {
            state.draft = item.mix;
          });
          if (saved) location.href = S.url("constructor.html");
          else S.notify("Не вдалося відкрити рецепт. Дозвольте збереження даних браузера.");
        });
      return link;
    }
    function summary() {
      const cart = S.get().cart,
        total = S.total(),
        items = document.querySelector(".checkout-order-items");
      renderedCart = JSON.parse(JSON.stringify(cart));
      items.replaceChildren(
        ...cart.map((i) =>
          n("div", {}, n("dt", {}, itemLink(i)), n("dd", { text: S.money(S.unit(i) * i.qty) })),
        ),
      );
      if (!cart.length)
        items.append(
          n(
            "div",
            {},
            n(
              "dt",
              {},
              n("a", { href: S.url("catalog.html"), text: "Кошик порожній. Обрати каву" }),
            ),
          ),
        );
      document.querySelector(".checkout-total-price").textContent = S.money(total);
      document.querySelector(".checkout-order-delivery strong").textContent =
        total >= 80000 ? "Безкоштовно" : "За тарифом перевізника";
      button.disabled = submitting || !cart.length;
    }
    const fields = ["customer-name", "customer-email", "customer-phone", "delivery-address"].map(
      (id) => document.getElementById(id),
    );
    const normalizedText = (value) => value.trim().replace(/\s+/g, " ");
    function fieldError(field, message) {
      const error = document.getElementById(`${field.id}-error`);
      error.textContent = message;
      error.hidden = !message;
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
    function validateField(field, normalize = false) {
      const value = normalizedText(field.value);
      if (normalize) field.value = value;
      let message = "";
      if (!value) message = "Заповніть це поле.";
      else if (field.id === "customer-name") {
        if (!/^[\p{L}\p{M}\s’'ʼ.-]+$/u.test(value) || (value.match(/\p{L}/gu) || []).length < 2)
          message = "Укажіть ім’я літерами, щонайменше дві літери.";
      } else if (field.id === "customer-email") {
        if (field.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          message = "Укажіть email у форматі name@example.com.";
      } else if (field.id === "customer-phone") {
        const phone = value.replace(/[\s()-]/g, "");
        if (!/^(?:\+?380|0)\d{9}$/.test(phone))
          message = "Укажіть український номер: +380671234567 або 0671234567.";
        else if (normalize)
          field.value = phone.startsWith("0") ? `+38${phone}` : `+${phone.replace(/^\+/, "")}`;
      } else if (field.id === "delivery-address") {
        if (form.querySelector('[name="delivery"]:checked').value === "ukrposhta") {
          if (!/\p{L}/u.test(value) || !/(?:^|\D)\d{5}(?!\d)/.test(value))
            message = "Укажіть місто та п’ятизначний поштовий індекс відділення Укрпошти.";
        } else if (value.length < 5 || !/\p{L}/u.test(value) || !/\d/.test(value))
          message =
            form.querySelector('[name="delivery"]:checked').value === "courier"
              ? "Укажіть місто, вулицю та номер будинку."
              : "Укажіть місто та номер відділення або поштомата.";
      }
      fieldError(field, message);
      return !message;
    }
    fields.forEach((field) => {
      field.addEventListener("blur", () => validateField(field, true));
      field.addEventListener("input", () => {
        if (field.hasAttribute("aria-invalid")) validateField(field);
        submitMessage.hidden = true;
      });
    });
    function updateDelivery() {
      const method = form.querySelector('[name="delivery"]:checked').value;
      const input = document.getElementById("delivery-address");
      const labels = {
        "nova-poshta": [
          "Місто та відділення Нової пошти",
          "Місто, номер відділення",
          "Укажіть місто та номер відділення Нової пошти.",
        ],
        ukrposhta: [
          "Місто та індекс відділення Укрпошти",
          "Місто, поштовий індекс відділення",
          "Укажіть місто та п’ятизначний індекс відділення Укрпошти.",
        ],
        courier: [
          "Адреса доставки",
          "Місто, вулиця, будинок, квартира",
          "Укажіть місто, вулицю, будинок і квартиру, якщо вона є.",
        ],
      };
      const [label, placeholder, help] = labels[method] || labels["nova-poshta"];
      form.querySelector('label[for="delivery-address"]').textContent = label;
      input.placeholder = placeholder;
      document.getElementById("mo-delivery-address-help").textContent = help;
      if (input.value.trim() || input.hasAttribute("aria-invalid")) validateField(input);
    }
    document.querySelectorAll('[name="delivery"]').forEach((input) =>
      input.addEventListener("change", () => {
        if (input.checked) updateDelivery();
      }),
    );
    updateDelivery();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submitting) return;
      submitMessage.hidden = true;
      if (!S.get().cart.length) {
        S.notify("Спочатку додайте каву до кошика.");
        return;
      }
      const invalid = fields.filter((field) => !validateField(field, true));
      if (invalid.length) {
        invalid[0].focus();
        return;
      }
      const expectedCart = JSON.parse(JSON.stringify(renderedCart));
      submitting = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        const result = await S.finishOrder({
          delivery: form.querySelector('[name="delivery"]:checked').value,
          expectedCart,
        });
        if (result.ok) {
          location.href = S.url("order-confirmation.html");
          return;
        }
        const messages = {
          changed:
            "Кошик змінився в іншій вкладці. Перевірте оновлений підсумок і підтвердьте ще раз.",
          empty: "Кошик уже порожній. Додайте каву, щоб створити демозамовлення.",
          "order-storage":
            "Не вдалося зберегти демопідсумок. Дозвольте сховище браузера; кошик залишився без змін.",
          "cart-storage":
            "Не вдалося підтвердити очищення кошика. Демозамовлення не створено, кошик залишився без змін.",
        };
        submitMessage.textContent =
          messages[result.reason] || "Не вдалося створити демозамовлення. Спробуйте ще раз.";
        submitMessage.hidden = false;
        summary();
      } catch {
        submitMessage.textContent =
          "Не вдалося завершити демонстрацію. Перевірте кошик і спробуйте ще раз.";
        submitMessage.hidden = false;
      } finally {
        submitting = false;
        button.removeAttribute("aria-busy");
        button.disabled = !S.get().cart.length;
      }
    });
    window.addEventListener("coffee:change", summary);
    summary();
    return;
  }
  const title = document.getElementById("confirmation-title");
  if (!title) return;
  title.textContent = "Демонстрацію оформлення завершено";
  document.querySelector(".confirmation-description").textContent =
    "Це навчальний приклад. Реальне замовлення не створено, оплату не проведено, листи не надсилалися.";
  const status = document.getElementById("confirmation-status");
  status.textContent = "Показано лише підсумок демонстраційного оформлення.";
  const order = S.get().lastOrder;
  const valid =
    order &&
    /^DEMO-[A-Z0-9-]{8}$/.test(order.id) &&
    Number.isSafeInteger(order.total) &&
    order.total >= 0 &&
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    order.items.length <= 50 &&
    order.items.every(
      (i) =>
        typeof i.name === "string" &&
        i.name.length <= 100 &&
        Number.isSafeInteger(i.total) &&
        i.total >= 0 &&
        Number.isInteger(i.qty) &&
        i.qty > 0 &&
        i.qty <= 99 &&
        Number.isInteger(i.weight),
    );
  const details = document.querySelector(".confirmation-order-details");
  details.replaceChildren();
  if (!valid) {
    document.getElementById("confirmation-order-title").textContent = "Немає демозамовлення";
    details.append(
      n(
        "div",
        {},
        n("dt", {}, n("a", { href: S.url("catalog.html"), text: "Перейти до каталогу" })),
      ),
    );
    return;
  }
  document.getElementById("confirmation-order-title").textContent = `Приклад ${order.id}`;
  const pair = (label, value) => n("div", {}, n("dt", { text: label }), n("dd", { text: value }));
  details.append(
    ...order.items.map((i) =>
      pair(
        `${i.name} · ${i.weight} г × ${i.qty}${i.details ? ` · ${i.details}` : ""}`,
        S.money(i.total),
      ),
    ),
    pair(
      "Спосіб доставки",
      { post: "Нова пошта", "nova-poshta": "Нова пошта", ukrposhta: "Укрпошта", courier: "Кур’єр" }[
        order.delivery
      ] || "Нова пошта",
    ),
    pair("Доставка", order.total >= 80000 ? "Безкоштовно" : "За тарифом перевізника"),
    pair("Разом за товари", S.money(order.total)),
  );
})();
