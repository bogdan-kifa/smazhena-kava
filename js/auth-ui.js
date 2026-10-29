/* Visual form interactions only: no authentication, requests or credential storage. */
(() => {
  "use strict";
  const form = document.querySelector("form[data-mo-auth]");
  if (!form) return;
  const $ = (id) => document.getElementById("mo-auth-" + id);
  const tabs = [...form.querySelectorAll('[role="tab"]')];
  const fields = [$("name"), $("email"), $("password"), $("confirm"), $("consent")];
  const motion = matchMedia("(prefers-reduced-motion: no-preference)"),
    phone = matchMedia("(max-width:767px)");
  const touched = new Set();
  let mode = "login",
    panelAnimation;
  function errorFor(input) {
    if (input.disabled) return "";
    if (input === $("consent"))
      return input.checked ? "" : "Потрібна згода з умовами та політикою конфіденційності.";
    const value = input.value;
    if (!value.trim())
      return input === $("name")
        ? "Введи своє ім’я."
        : input === $("email")
          ? "Введи електронну пошту."
          : input === $("confirm")
            ? "Повтори пароль."
            : "Введи пароль.";
    if (input === $("email") && !input.validity.valid)
      return "Перевір адресу, наприклад name@example.com.";
    if (
      input === $("password") &&
      mode === "register" &&
      (value.length < 8 || !/\p{L}/u.test(value) || !/\d/.test(value))
    )
      return "Використай щонайменше 8 символів, літеру й цифру.";
    if (input === $("confirm") && value !== $("password").value) return "Паролі не збігаються.";
    return "";
  }
  function validate(input) {
    const error = errorFor(input),
      box = document.getElementById(input.id + "-error");
    box.textContent = error;
    box.hidden = !error;
    if (error) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    return !error;
  }
  function requirements() {
    const password = $("password").value;
    $("password-hint").hidden = mode !== "register" || !password.length;
    for (const [id, ready] of [
      ["length", password.length >= 8],
      ["mix", /\p{L}/u.test(password) && /\d/.test(password)],
    ]) {
      const el = $("rule-" + id);
      el.dataset.ready = String(ready);
      el.textContent = `${ready ? "✓" : "○"} ${id === "length" ? "Щонайменше 8 символів" : "Літера та цифра"}`;
    }
  }
  function maskPasswords() {
    for (const button of form.querySelectorAll("[data-mo-toggle]")) {
      document.getElementById(button.dataset.moToggle).type = "password";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute(
        "aria-label",
        button.dataset.moToggle.endsWith("confirm")
          ? "Показати повторений пароль"
          : "Показати пароль",
      );
    }
  }
  function setMode(next, updateURL = true) {
    const changed = mode !== next;
    mode = next;
    form.dataset.mode = mode;
    for (const tab of tabs) {
      const active = tab.dataset.moMode === mode;
      tab.disabled = false;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    $("panel").setAttribute("aria-labelledby", "mo-auth-tab-" + mode);
    for (const section of form.querySelectorAll("[data-mo-register]")) {
      section.hidden = mode !== "register";
      for (const input of section.querySelectorAll("input")) {
        input.disabled = mode !== "register";
        input.required = mode === "register";
      }
    }
    form.querySelector("[data-mo-login]").hidden = mode === "register";
    $("password").autocomplete = mode === "register" ? "new-password" : "current-password";
    if (mode === "register") $("password").minLength = 8;
    else $("password").removeAttribute("minlength");
    $("submit").textContent = mode === "register" ? "Зареєструватися" : "Увійти";
    if (changed) {
      $("password").value = $("confirm").value = "";
      $("consent").checked = false;
    }
    maskPasswords();
    touched.clear();
    for (const input of fields) {
      input.removeAttribute("aria-invalid");
      const box = document.getElementById(input.id + "-error");
      box.hidden = true;
      box.textContent = "";
    }
    requirements();
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set("mode", mode);
      history.replaceState(null, "", url);
    }
    if (changed && motion.matches) {
      panelAnimation?.cancel();
      panelAnimation = $("panel").animate(
        [
          { opacity: 0, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 180, easing: "ease-out" },
      );
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setMode(tab.dataset.moMode));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target =
        event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs[(index + 1) % 2];
      setMode(target.dataset.moMode);
      target.focus();
    });
  });
  fields.forEach((input) => {
    input.addEventListener("blur", () => {
      if (input.disabled) return;
      touched.add(input.id);
      validate(input);
    });
    input.addEventListener(input.type === "checkbox" ? "change" : "input", () => {
      if (touched.has(input.id)) validate(input);
      if (input === $("password")) {
        requirements();
        if (touched.has($("confirm").id)) validate($("confirm"));
      }
    });
  });
  for (const button of form.querySelectorAll("[data-mo-toggle]")) {
    button.hidden = false;
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.moToggle),
        visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute(
        "aria-label",
        `${visible ? "Приховати" : "Показати"} ${input === $("confirm") ? "повторений пароль" : "пароль"}`,
      );
    });
  }
  function inspectForm(event) {
    event.preventDefault();
    let first;
    for (const input of fields.filter((input) => !input.disabled)) {
      touched.add(input.id);
      if (!validate(input) && !first) first = input;
    }
    if (first) {
      first.focus();
      if (motion.matches)
        form.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-3px)" },
            { transform: "translateX(3px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 190 },
        );
    } else
      $("feedback").textContent = "Дані заповнено. Вхід і реєстрація будуть доступні незабаром.";
  }
  form.addEventListener("submit", inspectForm);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches('input:not([type="checkbox"])'))
      inspectForm(event);
  });
  const params = new URLSearchParams(location.search);
  setMode(params.get("mode") === "register" ? "register" : "login", false);
  $("return").hidden = params.get("next") !== "constructor.html?save=1";
  function guestRoute() {
    const hasItems = Boolean(window.CoffeeShop?.get().cart.length);
    $("guest").href = hasItems ? "checkout.html" : "catalog.html";
    $("guest").replaceChildren(
      document.createTextNode(
        hasItems ? "Оформити без реєстрації " : "Обрати каву без реєстрації ",
      ),
    );
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    $("guest").append(arrow);
  }
  guestRoute();
  addEventListener("coffee:change", guestRoute);
  addEventListener("pagehide", maskPasswords);
  addEventListener("popstate", () =>
    setMode(
      new URLSearchParams(location.search).get("mode") === "register" ? "register" : "login",
      false,
    ),
  );
  const viewport = window.visualViewport;
  let fullHeight = innerHeight;
  function keyboardLayout() {
    if (!viewport) return;
    if (!form.contains(document.activeElement)) fullHeight = Math.max(fullHeight, innerHeight);
    const open =
      phone.matches &&
      form.contains(document.activeElement) &&
      document.activeElement.matches("input") &&
      viewport.height < fullHeight * 0.78;
    form.classList.toggle("mo-auth-keyboard", open);
    form.style.setProperty(
      "--mo-auth-keyboard-bottom",
      Math.max(0, innerHeight - viewport.height - viewport.offsetTop) + "px",
    );
  }
  viewport?.addEventListener("resize", keyboardLayout);
  viewport?.addEventListener("scroll", keyboardLayout);
  form.addEventListener("focusin", keyboardLayout);
  form.addEventListener("focusout", () => setTimeout(keyboardLayout, 0));
  phone.addEventListener("change", keyboardLayout);
})();
