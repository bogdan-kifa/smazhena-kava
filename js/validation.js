/* ЛР №9, етапи 8–9: перевірка даних у браузері без надсилання. */
(() => {
  "use strict";

  const form = document.getElementById("feedbackForm");
  if (!form) return;

  const REGEX_PHONE = /^\+380\d{9}$/;
  const REGEX_EMAIL = /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const fields = {
    name: document.getElementById("username"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    message: document.getElementById("message"),
    agreement: document.getElementById("agreement"),
  };
  const errorIds = {
    name: "nameError", email: "emailError", phone: "phoneError",
    message: "messageError", agreement: "agreementError",
  };
  const interacted = new Set();
  // Для імені й повідомлення рахуємо кодові точки Unicode.
  // HTML maxlength не застосовується: він рахує одиниці UTF-16.
  const length = (value) => Array.from(value).length;

  // Колір доповнюється текстом, aria-invalid і доступним повідомленням.
  function showError(key, message) {
    const input = fields[key], error = document.getElementById(errorIds[key]);
    input.classList.remove("border-green-500");
    input.classList.add("border-red-500");
    input.setAttribute("aria-invalid", "true");
    input.closest(".mo-contact-field").dataset.state = "error";
    error.classList.remove("visually-hidden");
    error.textContent = message;
    error.hidden = false;
  }

  function showSuccess(key) {
    const input = fields[key], error = document.getElementById(errorIds[key]);
    input.classList.remove("border-red-500");
    input.classList.add("border-green-500");
    input.setAttribute("aria-invalid", "false");
    input.closest(".mo-contact-field").dataset.state = "success";
    error.textContent = "Поле заповнено правильно.";
    error.classList.add("visually-hidden");
    error.hidden = false;
  }

  function clearError(key) {
    const input = fields[key], error = document.getElementById(errorIds[key]);
    input.classList.remove("border-red-500", "border-green-500");
    input.setAttribute("aria-invalid", "false");
    delete input.closest(".mo-contact-field").dataset.state;
    error.hidden = true;
    error.textContent = "";
    error.classList.remove("visually-hidden");
  }

  function result(key, valid, message, display) {
    if (display) {
      if (valid) showSuccess(key);
      else showError(key, message);
    }
    return valid;
  }

  function validateName(display = true) {
    const size = length(fields.name.value.trim());
    return result("name", size >= 2 && size <= 80,
      "Введіть ім’я — від 2 до 80 символів.", display);
  }

  function validateEmail(display = true) {
    const value = fields.email.value.trim(), local = value.split("@")[0];
    const valid = value.length <= 254 && local.length <= 64 &&
      REGEX_EMAIL.test(value) && !local.startsWith(".") &&
      !local.endsWith(".") && !local.includes("..");
    return result("email", valid, "Введіть коректну електронну адресу.", display);
  }

  function validatePhone(display = true) {
    // Строга перевірка: не обрізаємо пробіли і не змінюємо введений номер.
    const value = fields.phone.value;
    return result("phone", value.length === 13 && REGEX_PHONE.test(value),
      "Введіть номер у форматі +380XXXXXXXXX, без пробілів і дужок.", display);
  }

  function validateMessage(display = true) {
    const size = length(fields.message.value.trim());
    return result("message", size >= 10 && size <= 2000,
      "Напишіть повідомлення — від 10 до 2000 символів.", display);
  }

  function validateAgreement(display = true) {
    return result("agreement", fields.agreement.checked,
      "Підтвердьте згоду з політикою конфіденційності.", display);
  }

  const validators = {
    name: validateName, email: validateEmail, phone: validatePhone,
    message: validateMessage, agreement: validateAgreement,
  };

  const modal = document.getElementById("successModal");
  const submitButton = document.getElementById("feedbackSubmit");
  const phoneFix = document.createElement("button");
  phoneFix.type = "button";
  phoneFix.className = "mo-contact-phone-fix min-h-12 cursor-pointer rounded-control border border-solid border-brand-control bg-brand-soft px-3 py-2 text-sm font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  phoneFix.hidden = true;
  document.getElementById("phoneHint").after(phoneFix);

  // Пропонуємо лише однозначне виправлення формату. Цифри не обрізаємо.
  function phoneSuggestion(value) {
    if (!/^[+0-9\s()-]+$/.test(value)) return "";
    const compact = value.replace(/[\s()-]/g, "");
    const candidate = /^0\d{9}$/.test(compact) ? "+38" + compact : compact;
    return candidate !== value && candidate.length === 13 && REGEX_PHONE.test(candidate) ? candidate : "";
  }

  function updatePhoneSuggestion() {
    const candidate = phoneSuggestion(fields.phone.value);
    phoneFix.hidden = !candidate;
    phoneFix.textContent = candidate ? "Використати " + candidate : "";
  }

  phoneFix.addEventListener("click", () => {
    const candidate = phoneSuggestion(fields.phone.value);
    if (!candidate) return;
    fields.phone.value = candidate;
    interacted.add("phone");
    delete form.dataset.validation;
    validatePhone();
    updatePhoneSuggestion();
    fields.phone.focus();
  });

  // Native dialog утримує фокус усередині та підтримує Escape.
  document.getElementById("closeModalBtn").addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => submitButton.focus({ preventScroll: true }));

  for (const [key, input] of Object.entries(fields)) {
    const error = document.getElementById(errorIds[key]);
    error.setAttribute("aria-live", "polite");
    error.setAttribute("aria-atomic", "true");
    clearError(key);

    input.addEventListener("blur", () => {
      interacted.add(key);
      validators[key]();
      if (key === "phone") updatePhoneSuggestion();
    });
    input.addEventListener("input", () => {
      delete form.dataset.validation;
      // Під час першого введення не сваримо за незавершений текст.
      // Після blur або submit помилка одразу оновлюється при виправленні.
      const valid = validators[key](false);
      if (interacted.has(key) || valid) validators[key]();
      else clearError(key);
      if (key === "phone" && interacted.has(key)) updatePhoneSuggestion();
    });
    if (key === "agreement") input.addEventListener("change", () => {
      interacted.add(key);
      validators[key]();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (modal.open) return;
    // Перевіряємо всі поля, не зупиняючись на першій помилці.
    const invalid = Object.keys(fields).filter((key) => {
      interacted.add(key);
      return !validators[key]();
    });
    form.dataset.validation = invalid.length ? "invalid" : "valid";
    updatePhoneSuggestion();
    if (invalid.length) {
      fields[invalid[0]].focus();
      return;
    }
    // Лише демонстрація: немає fetch, POST-запиту або збереження даних.
    modal.showModal();
    form.reset();
  });

  form.addEventListener("reset", () => {
    interacted.clear();
    phoneFix.hidden = true;
    phoneFix.textContent = "";
    delete form.dataset.validation;
    Object.keys(fields).forEach(clearError);
  });

  // Активуємо кнопку лише після успішного встановлення всіх обробників.
  // Без JavaScript вона залишається вимкненою: POST-запит не виконується.
  form.noValidate = true;
  submitButton.disabled = false;
})();
