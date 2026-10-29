/* UI contract for a future account service. No local login flag or simulated session. */
(() => {
  "use strict";
  const S = window.CoffeeShop;
  if (!S) return;
  const { node: n } = S;
  let client = null,
    checking = false,
    submitting = false,
    snapshot = null,
    opener = null;
  let authDialog, nameDialog, nameInput, nameError, saveError, submitButton, authError;

  async function getUser() {
    if (!client) return null;
    const user = await client.getUser();
    return user && typeof user.id === "string" && user.id.trim() ? user : null;
  }
  function configureClient(next) {
    if (
      next !== null &&
      (!next || typeof next.getUser !== "function" || typeof next.saveMix !== "function")
    )
      throw new TypeError("Account client requires getUser and saveMix methods.");
    client = next;
  }
  function returnFocus() {
    if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
  }
  function closeButton(dialog) {
    const button = n("button", {
      type: "button",
      class: "account-dialog-close",
      "aria-label": "Закрити вікно",
      text: "×",
    });
    button.addEventListener("click", () => {
      if (!submitting) dialog.close();
    });
    return button;
  }
  function buildDialogs() {
    if (authDialog) return;
    authDialog = n("dialog", {
      id: "mix-auth-dialog",
      class: "account-dialog",
      "aria-labelledby": "mix-auth-title",
    });
    authError = n("p", { class: "account-error", role: "alert", hidden: true });
    const links = [
      ["login", "Увійти"],
      ["register", "Зареєструватися"],
    ].map(([mode, text]) => {
      const params = new URLSearchParams({ mode, next: "constructor.html?save=1" });
      const link = n("a", {
        href: S.url(`login.html?${params}`),
        class: `button${mode === "register" ? " button-secondary" : ""}`,
        text,
      });
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        authError.hidden = true;
        if (await S.update(() => {})) location.href = link.href;
        else {
          authError.textContent =
            "Не вдалося зберегти налаштування перед входом. Перевірте дозвіл браузера на збереження даних і спробуйте ще раз.";
          authError.hidden = false;
        }
      });
      return link;
    });
    const continueButton = n("button", {
      type: "button",
      class: "account-dialog-quiet",
      text: "Продовжити налаштування",
    });
    continueButton.addEventListener("click", () => authDialog.close());
    authDialog.append(
      n(
        "div",
        { class: "account-dialog-header" },
        n("h2", { id: "mix-auth-title", text: "Збережіть мікс у своєму акаунті" }),
        closeButton(authDialog),
      ),
      n("p", {
        text: "Увійдіть або зареєструйтеся, щоб зберегти рецепт. Після входу ви зможете дати йому назву.",
      }),
      n("div", { class: "account-dialog-actions" }, links),
      authError,
      continueButton,
    );
    authDialog.addEventListener("close", returnFocus);

    nameDialog = n("dialog", {
      id: "mix-name-dialog",
      class: "account-dialog",
      "aria-labelledby": "mix-name-title",
    });
    const form = n("form", { id: "mix-save-form", novalidate: "" });
    nameInput = n("input", {
      id: "mix-save-name",
      name: "mix-name",
      type: "text",
      maxlength: 60,
      required: "",
      autocomplete: "off",
      "aria-describedby": "mix-save-name-error",
    });
    nameError = n("p", {
      id: "mix-save-name-error",
      class: "account-error",
      role: "alert",
      hidden: true,
    });
    saveError = n("p", {
      id: "mix-save-error",
      class: "account-error",
      role: "alert",
      hidden: true,
    });
    submitButton = n("button", { type: "submit", class: "button", text: "Зберегти" });
    const cancel = n("button", {
      type: "button",
      class: "button button-secondary",
      "data-cancel-save": "",
      text: "Скасувати",
    });
    cancel.addEventListener("click", () => {
      if (!submitting) nameDialog.close();
    });
    form.append(
      n("p", { id: "mix-save-summary", class: "account-recipe-summary" }),
      n(
        "div",
        { class: "account-field" },
        n("label", { for: "mix-save-name", text: "Назва міксу" }),
        nameInput,
        nameError,
      ),
      saveError,
      n("div", { class: "account-dialog-actions" }, submitButton, cancel),
    );
    nameDialog.append(
      n(
        "div",
        { class: "account-dialog-header" },
        n("h2", { id: "mix-name-title", text: "Зберегти свій рецепт" }),
        closeButton(nameDialog),
      ),
      form,
    );
    nameDialog.addEventListener("cancel", (event) => {
      if (submitting) event.preventDefault();
    });
    nameDialog.addEventListener("close", returnFocus);
    nameInput.addEventListener("input", () => {
      nameError.hidden = true;
      saveError.hidden = true;
      nameInput.removeAttribute("aria-invalid");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      const name = nameInput.value.trim().replace(/\s+/g, " ");
      if (!name || name.length > 60) {
        nameError.textContent = !name
          ? "Введіть назву міксу."
          : "Назва має містити не більше 60 символів.";
        nameError.hidden = false;
        nameInput.setAttribute("aria-invalid", "true");
        nameInput.focus();
        return;
      }
      submitting = true;
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.textContent = "Зберігаємо…";
      nameDialog
        .querySelectorAll("[data-cancel-save],.account-dialog-close")
        .forEach((button) => (button.disabled = true));
      saveError.hidden = true;
      try {
        if (!(await getUser())) {
          nameDialog.close();
          showAuth();
          return;
        }
        const saved = await client.saveMix({ name, recipe: { ...snapshot, name } });
        if (!saved || typeof saved.id !== "string" || !saved.id.trim())
          throw new Error("Save was not confirmed.");
        nameDialog.close();
        S.notify(`Мікс «${name}» збережено.`);
      } catch {
        saveError.textContent = "Не вдалося зберегти мікс. Спробуйте ще раз.";
        saveError.hidden = false;
      } finally {
        submitting = false;
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.textContent = "Зберегти";
        nameDialog
          .querySelectorAll("[data-cancel-save],.account-dialog-close")
          .forEach((button) => (button.disabled = false));
      }
    });
    document.body.append(authDialog, nameDialog);
  }
  function showAuth() {
    authError.hidden = true;
    if (!authDialog.open) authDialog.showModal();
  }
  async function requestSave() {
    if (checking || authDialog?.open || nameDialog?.open) return;
    const draft = S.get().draft;
    if (!S.validMix(draft)) {
      S.notify("Оберіть сорти та встановіть суму часток 100%.");
      return;
    }
    checking = true;
    opener = document.querySelector(".mix-summary-actions button.button-secondary");
    try {
      buildDialogs();
      if (!(await getUser())) {
        showAuth();
        return;
      }
      snapshot = S.recipe(S.get().draft);
      if (!S.validMix(snapshot)) {
        S.notify("Склад змінився. Перевірте частки міксу.");
        return;
      }
      nameInput.value = snapshot.name && snapshot.name !== "Мій мікс" ? snapshot.name : "";
      nameInput.removeAttribute("aria-invalid");
      nameError.hidden = saveError.hidden = true;
      document.getElementById("mix-save-summary").textContent =
        `${S.composition(snapshot)} · ${snapshot.weight} г`;
      nameDialog.showModal();
      nameInput.focus();
      nameInput.select();
    } catch {
      S.notify("Не вдалося перевірити акаунт. Спробуйте ще раз.");
    } finally {
      checking = false;
    }
  }
  window.CoffeeAccount = Object.freeze({ configureClient, getUser, requestSave });

  const loginForm = document.getElementById("login-form");
  if (loginForm && !loginForm.hasAttribute("data-mo-auth")) {
    const params = new URLSearchParams(location.search);
    const nameField = n(
      "div",
      { class: "login-field", hidden: true },
      n("label", { for: "account-name", text: "Ім’я" }),
      n("input", {
        id: "account-name",
        name: "name",
        type: "text",
        autocomplete: "name",
        maxlength: 80,
      }),
    );
    const repeatField = n(
      "div",
      { class: "login-field", hidden: true },
      n("label", { for: "account-password-confirm", text: "Повторіть пароль" }),
      n("input", {
        id: "account-password-confirm",
        name: "password-confirm",
        type: "password",
        autocomplete: "new-password",
      }),
    );
    loginForm.querySelector(".login-modes").after(nameField);
    loginForm.querySelector(".login-submit").before(repeatField);
    const status = document.getElementById("login-status");
    status.textContent = "Вхід і реєстрація будуть доступні незабаром.";
    status.classList.remove("visually-hidden");
    status.classList.add("account-preparation-note");
    loginForm.querySelector(".login-description").textContent =
      "Зберігайте улюблені рецепти у своєму акаунті.";
    const setMode = (mode) => {
      const register = mode === "register";
      nameField.hidden = repeatField.hidden = !register;
      nameField.querySelector("input").disabled = repeatField.querySelector("input").disabled =
        !register;
      loginForm.querySelectorAll(".login-mode").forEach((button) => {
        button.disabled = false;
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      });
      document.getElementById("login-form-title").textContent = register
        ? "Створіть акаунт"
        : "Вхід до акаунта";
      document.querySelector(".login-heading h1").textContent = register ? "Реєстрація" : "Вхід";
      document.getElementById("login-password").autocomplete = register
        ? "new-password"
        : "current-password";
      loginForm.querySelector(".login-submit").textContent = register
        ? "Зареєструватися"
        : "Увійти";
      loginForm.querySelector(".login-password-reset").hidden = register;
      const url = new URL(location.href);
      url.searchParams.set("mode", mode);
      history.replaceState(null, "", url);
    };
    loginForm
      .querySelectorAll(".login-mode")
      .forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
    loginForm.addEventListener("submit", (event) => event.preventDefault());
    setMode(params.get("mode") === "register" ? "register" : "login");
    if (params.get("next") === "constructor.html?save=1")
      loginForm.append(
        n("a", {
          class: "account-return-link",
          href: S.url("constructor.html"),
          text: "Повернутися до міксу",
        }),
      );
  }
})();
