(() => {
  "use strict";
  const S = window.CoffeeShop,
    { node: n } = S;
  const form = document.getElementById("checkout-form");
  if (form) {
    // The API verifies every field and recomputes the order from the canonical catalog.
    form.noValidate = true;
    let submitting = false,
      renderedCart = [];
    const button = document.querySelector('[data-action="confirm-order"]');
    const submitMessage = document.getElementById("checkout-submit-message");
    button.textContent = window.CoffeeSite?.demo ? "Створити демозамовлення" : "Оформити замовлення";
    const status = document.getElementById("checkout-status");
    status.textContent = window.CoffeeSite?.demo ? "Демонстрація оформлення. Замовлення нікуди не надсилається." : "Оплата при отриманні. Замовлення з акаунта з’явиться у вашій історії.";
    status.classList.remove("visually-hidden");
    form
      .querySelectorAll("fieldset[disabled],input[disabled]")
      .forEach((x) => (x.disabled = false));
    const guest = document.getElementById("guest-checkout");
    guest.disabled = true;
    CoffeeAPI.getUser()
      .then((user) => {
        guest.parentElement.hidden = true;
        guest.checked = !user;
        if (!user) {
          status.textContent = window.CoffeeSite?.demo ? "Демонстрація оформлення без реєстрації." : "Оформлення без реєстрації · оплата при отриманні.";
          return;
        }
        for (const [id, value] of [
          ["customer-name", user.name],
          ["customer-email", user.email],
          ["customer-phone", user.phone],
          ["delivery-address", user.address],
        ]) {
          const field = document.getElementById(id);
          if (!field.value) field.value = value || "";
        }
      })
      .catch(() => {});
    // Card payments are not connected; only payment on receipt is offered.
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
        if (Array.from(value).length < 2 || Array.from(value).length > 80)
          message = "Укажіть ім’я від 2 до 80 символів.";
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
        const body = {
          delivery: form.querySelector('[name="delivery"]:checked').value,
          customer: {
            name: fields[0].value,
            email: fields[1].value,
            phone: fields[2].value,
            address: fields[3].value,
          },
          items: expectedCart,
          expectedTotal: expectedCart.reduce((sum, item) => sum + S.unit(item) * item.qty, 0),
        };
        // Persist only an opaque key and a digest, never customer fields or passwords.
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(body)),
        );
        const fingerprint = Array.from(new Uint8Array(bytes), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join("");
        let previous;
        try {
          previous = JSON.parse(sessionStorage.getItem("coffee-order-request"));
        } catch {}
        const key = previous?.fingerprint === fingerprint ? previous.key : crypto.randomUUID();
        try {
          sessionStorage.setItem("coffee-order-request", JSON.stringify({ key, fingerprint }));
        } catch {}
        const { order } = await CoffeeAPI.request("orders", {
          method: "POST",
          body,
          headers: { "Idempotency-Key": key },
        });
        await S.update((state) => {
          if (JSON.stringify(state.cart) === JSON.stringify(expectedCart)) state.cart = [];
        });
        location.href = S.url("order-confirmation.html?id=" + encodeURIComponent(order.id));
        return;
      } catch (error) {
        submitMessage.textContent =
          error.message ||
          "Не вдалося створити замовлення. Перевірте з’єднання та спробуйте ще раз.";
        submitMessage.hidden = false;
        summary();
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
  const status = document.getElementById("confirmation-status");
  const description = document.querySelector(".confirmation-description");
  const details = document.querySelector(".confirmation-order-details");
  const confirmationActions = n("div", { class: "mo-confirmation-actions" });
  details.after(confirmationActions);
  details.replaceChildren();
  title.textContent = "Перевіряємо замовлення…";
  description.textContent = "";
  status.textContent = "Завантажуємо підтвердження.";
  const id = new URLSearchParams(location.search).get("id");
  (async () => {
    try {
      if (!id || !/^[a-f0-9-]{36}$/.test(id))
        throw new Error(
          "Відкрийте підтвердження після оформлення або знайдіть замовлення у своєму кабінеті.",
        );
      const { order } = await CoffeeAPI.request("orders/" + encodeURIComponent(id));
      title.textContent = window.CoffeeSite?.demo ? "Демозамовлення створено" : "Дякуємо за замовлення!";
      description.textContent = window.CoffeeSite?.demo ? "Демозамовлення створено. Воно не надсилається магазину й не потребує оплати." : "Замовлення прийнято. Оплата — при отриманні.";
      status.textContent = window.CoffeeSite?.demo ? "Демозамовлення збережено лише в цьому браузері." : "Замовлення збережено на сервері.";
      document.getElementById("confirmation-order-title").textContent =
        "Замовлення №" + order.id.slice(0, 8).toUpperCase();
      const pair = (label, value) =>
        n("div", {}, n("dt", { text: label }), n("dd", { text: value }));
      details.append(
        ...order.items.map((item) =>
          pair(
            `${item.name} · ${item.weight} г × ${item.qty} · ${item.details}`,
            S.money(item.total),
          ),
        ),
        pair("Отримувач", order.customer.name),
        pair("Телефон", order.customer.phone),
        pair(
          "Спосіб доставки",
          {
            post: "Нова пошта",
            "nova-poshta": "Нова пошта",
            ukrposhta: "Укрпошта",
            courier: "Кур’єр",
          }[order.delivery],
        ),
        pair("Адреса", order.customer.address),
        pair("Доставка", order.total >= 80000 ? "Безкоштовно" : "За тарифом перевізника"),
        pair("Разом за товари", S.money(order.total)),
      );
      const user = await CoffeeAPI.getUser();
      if (user)
        confirmationActions.append(
          n(
            "div",
            {},
            n("a", {
              href: S.url("orders.html"),
              class: "button button-secondary",
              text: "Мої замовлення",
            }),
          ),
        );
    } catch (error) {
      title.textContent = "Підтвердження недоступне";
      description.textContent = error.message;
      status.textContent =
        "Перевірте, чи ви увійшли у потрібний акаунт. Гостьове підтвердження доступне в браузері оформлення протягом доби.";
      document.getElementById("confirmation-order-title").textContent = "Перейти далі";
      confirmationActions.append(
        n(
          "div",
          {},
          n("a", { href: S.url("orders.html"), class: "button", text: "Історія замовлень" }),
        ),
      );
    }
  })();
})();
