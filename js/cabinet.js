(() => {
  "use strict";
  const API = window.CoffeeAPI,
    S = window.CoffeeShop,
    main = document.getElementById("cabinet-content");
  if (!main || !API) return;
  const n = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const status = document.getElementById("cabinet-status"),
    content = document.getElementById("cabinet-body");
  const message = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle("mo-cabinet-error", error);
  };
  const nav = document.getElementById("cabinet-nav");
  function button(text, action, secondary = false) {
    const e = n("button", text, "button" + (secondary ? " button-secondary" : ""));
    e.type = "button";
    e.addEventListener("click", action);
    return e;
  }
  function inputField(form, id, label, value, type = "text", autocomplete = "off") {
    const wrap = n("div", null, "mo-cabinet-field"),
      l = n("label", label),
      i = n("input");
    l.htmlFor = id;
    i.id = id;
    i.name = id;
    i.type = type;
    i.value = value || "";
    i.autocomplete = autocomplete;
    const error = n("p", "", "mo-cabinet-error");
    error.id = id + "-error"; error.hidden = true; error.setAttribute("aria-live", "polite");
    i.setAttribute("aria-describedby", error.id);
    i.addEventListener("input", () => { error.hidden = true; i.removeAttribute("aria-invalid"); });
    wrap.append(l, i, error);
    form.append(wrap);
    return i;
  }
  function gate() {
    const session = document.getElementById("cabinet-session");
    if (session) session.hidden = true;
    document.querySelector(".mo-cabinet-welcome").hidden = true;
    message("Увійдіть, щоб переглянути свій кабінет.");
    content.replaceChildren();
    const a = n("a", (window.CoffeeSite?.demo ? "Відкрити демопрофіль" : "Увійти або зареєструватися"), "button");
    a.href = S.url("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop()));
    content.append(a);
    nav.hidden = true;
  }
  async function render() {
    try {
      const user = await API.getUser();
      if (!user) return gate();
      nav.hidden = false;
      document.querySelector(".mo-cabinet-welcome").hidden = false;
      message("");
      document.querySelectorAll("[data-cabinet-name]").forEach((e) => (e.textContent = user.name));
      if (main.dataset.page === "profile") renderProfile(user);
      else await renderOrders();
    } catch (e) {
      message(e.message, true);
      content.replaceChildren(button("Спробувати ще раз", render, true));
    }
  }
  function fieldError(input, text) {
    const error = document.getElementById(input.id + "-error");
    error.textContent = text; error.hidden = !text; input.setAttribute("aria-invalid", String(Boolean(text)));
    return !text;
  }
  function renderProfile(user) {
    document.getElementById("cabinet-session").hidden = false;
    const form = n("form", null, "mo-cabinet-card"),
      h = n("h2", "Ваші дані");
    form.append(h);
    const name = inputField(form, "profile-name", "Ім’я", user.name, "text", "name");
    name.required = true;
    name.minLength = 2;
    name.maxLength = 80;
    const email = inputField(
      form,
      "profile-email",
      "Електронна пошта",
      user.email,
      "email",
      "email",
    );
    email.readOnly = !window.CoffeeSite?.demo;
    const emailHint = n("p", window.CoffeeSite?.demo ? "Демонстраційна адреса: листи не надсилаються." : "Це адреса для входу. Її зміна потребує підтвердження через підтримку.", "mo-cabinet-hint");
    emailHint.id = "profile-email-hint"; email.after(emailHint);
    email.setAttribute("aria-describedby", "profile-email-hint");
    const phone = inputField(form, "profile-phone", "Телефон", user.phone, "tel", "tel");
    phone.maxLength = 30;
    const address = inputField(
      form,
      "profile-address",
      "Адреса доставки",
      user.address,
      "text",
      "street-address",
    );
    address.maxLength = 300;
    const submit = n("button", "Зберегти зміни", "button");
    submit.type = "submit";
    form.noValidate = true;
    form.append(submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const validName = fieldError(name, name.value.trim().length < 2 || Array.from(name.value.trim()).length > 80 ? "Укажіть ім’я від 2 до 80 символів." : "");
      const compactPhone = phone.value.replace(/[\s()-]/g, "");
      const validPhone = fieldError(phone, phone.value && !/^(?:\+380\d{9}|0\d{9})$/.test(compactPhone) ? "Укажіть номер +380XXXXXXXXX або 0XXXXXXXXX." : "");
      const validEmail = fieldError(email, email.validity.typeMismatch || !email.value.trim() ? "Укажіть коректний email." : "");
      if (!validName || !validEmail || !validPhone) { (!validName ? name : !validEmail ? email : phone).focus(); return; }
      submit.disabled = true;
      message("Зберігаємо…");
      try {
        const result = await API.request("profile", {
          method: "PATCH",
          body: { name: name.value, email: email.value, phone: phone.value, address: address.value },
        });
        message("Профіль оновлено.");
        document
          .querySelectorAll("[data-cabinet-name]")
          .forEach((e) => (e.textContent = result.user.name));
      } catch (e) {
        fieldError(name, e.message); name.focus();
      } finally {
        submit.disabled = false;
      }
    });
    const password = n("form", null, "mo-cabinet-card");
    password.append(n("h2", "Змінити пароль"));
    const old = inputField(
        password,
        "profile-current-password",
        "Поточний пароль",
        "",
        "password",
        "current-password",
      ),
      next = inputField(
        password,
        "profile-new-password",
        "Новий пароль",
        "",
        "password",
        "new-password",
      );
    old.required = next.required = true;
    next.minLength = 8;
    next.maxLength = 128;
    password.append(n("p", "Щонайменше 8 символів, літера й цифра.", "mo-cabinet-hint"));
    const change = n("button", "Оновити пароль", "button button-secondary");
    change.type = "submit";
    password.noValidate = true;
    const passwordStatus = n("p", "", "mo-cabinet-hint"); passwordStatus.setAttribute("role", "status");
    password.append(change, passwordStatus);
    password.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (window.CoffeeSite?.demo) { password.reset(); passwordStatus.textContent = "Демонстрація завершена. Справжній пароль не змінювався."; return; }
      const validOld = fieldError(old, !old.value ? "Введіть поточний пароль." : "");
      const validNext = fieldError(next, next.value.trim().length < 8 || next.value.length > 128 || !/\p{L}/u.test(next.value) || !/\d/.test(next.value) ? "Від 8 до 128 символів, щонайменше літера й цифра." : "");
      if (!validOld || !validNext) { (validOld ? next : old).focus(); return; }
      change.disabled = true;
      try {
        await API.request("auth/password", {
          method: "POST",
          body: { currentPassword: old.value, password: next.value },
        });
        password.reset();
        passwordStatus.textContent = "Пароль змінено. Інші сеанси завершено.";
      } catch (e) {
        passwordStatus.textContent = e.message;
        if (e.status === 401) { fieldError(old, e.message); old.focus(); }
      } finally {
        change.disabled = false;
      }
    });
    content.replaceChildren(form, password);
    if (window.CoffeeSite?.demo) passwordStatus.textContent = "Демонстраційна форма: пароль не перевіряється й не зберігається. Не вводьте справжній пароль.";
  }
  async function renderOrders(cursor = null) {
    const { orders, nextCursor, total } = await API.request("orders" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""));
    if (!orders.length) {
      const empty = n("section", null, "mo-cabinet-card");
      empty.append(
        n("h2", "Замовлень поки немає"),
        n("p", "Обирайте каву — замовлення з цього акаунта з’являться тут."),
      );
      const a = n("a", "Переглянути каву", "button");
      a.href = S.url("catalog.html");
      empty.append(a);
      content.replaceChildren(empty);
      return;
    }
    if (!cursor) content.replaceChildren();
    content.querySelector(".mo-orders-more")?.remove();
    content.append(
      ...orders.map((order) => {
        const card = n("article", null, "mo-cabinet-card");
        const title = n("h2", "Замовлення №" + order.id.slice(0, 8).toUpperCase()); title.tabIndex = -1; card.append(title);
        const date = n(
          "time",
          new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(order.createdAt),
          ),
        );
        date.dateTime = order.createdAt;
        card.append(
          date,
          n(
            "span",
            {
              new: "Прийнято",
              processing: "Готуємо",
              shipped: "Відправлено",
              completed: "Виконано",
              cancelled: "Скасовано",
            }[order.status] || order.status,
            "mo-cabinet-badge",
          ),
        );
        for (const item of order.items) {
          const line = n("div", null, "mo-cabinet-order-line");
          const img = n("img");
          img.src = S.url(item.image);
          img.alt = "";
          img.width = 64;
          img.height = 64;
          img.loading = "lazy";
          const copy = n("div");
          copy.append(
            n("strong", item.name),
            n("p", `${item.weight} г × ${item.qty}`),
            n("p", item.details, "mo-cabinet-hint"),
          );
          line.append(img, copy, n("strong", S.money(item.total)));
          card.append(line);
        }
        card.append(
          n("p", "Разом за товари: " + S.money(order.total), "mo-cabinet-total"),
          n(
            "p",
            ({
              post: "Нова пошта",
              "nova-poshta": "Нова пошта",
              ukrposhta: "Укрпошта",
              courier: "Кур’єр",
            }[order.delivery] || order.delivery) +
              " · " +
              order.customer.address,
          ),
          n("p", window.CoffeeSite?.demo ? "Демозамовлення · оплата не проводиться." : "Оплата при отриманні.", "mo-cabinet-hint"),
        );
        return card;
      }),
    );
    const shown = content.querySelectorAll("article").length;
    message(`Показано ${shown} із ${total} замовлень.`);
    if (nextCursor) {
      const more = button("Показати ще", async () => {
        more.disabled = true;
        try { await renderOrders(nextCursor); content.querySelectorAll("article")[shown]?.querySelector("h2")?.focus(); }
        catch (error) { message(error.message, true); more.disabled = false; }
      }, true);
      more.classList.add("mo-orders-more"); content.append(more);
    }
  }
  document.getElementById("cabinet-logout")?.addEventListener("click", async (event) => {
    const logoutButton = event.currentTarget;
    logoutButton.disabled = true;
    try {
      await API.logout();
      gate();
      content.querySelector("a")?.focus();
    } catch (e) {
      message(e.message, true);
    } finally {
      logoutButton.disabled = false;
    }
  });
  addEventListener("pageshow", (event) => {
    if (event.persisted) render();
  });
  render();
})();
