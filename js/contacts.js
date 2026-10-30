/* Contact-page behaviour. Live delivery is off until an endpoint is configured. */
(() => {
  "use strict";
  const CONFIG = Object.freeze({ endpoint: "", mode: "demo", timeoutMs: 10000, minFillMs: 2000, demoDelayMs: 600 });
  const form = document.getElementById("feedbackForm");
  if (!form) return;
  const byId = (id) => document.getElementById(id);
  const contact = window.CoffeeFooterConfig || {};
  const modal = byId("successModal"), submit = byId("feedbackSubmit"), label = byId("submitLabel");
  const summary = byId("errorSummary"), summaryList = byId("errorSummaryList");
  const sendError = byId("sendError"), sendErrorText = byId("sendErrorText"), retry = byId("retrySubmit");
  const fields = { name: byId("username"), email: byId("email"), phone: byId("phone"), topic: byId("topic"), message: byId("message"), agreement: byId("agreement") };
  const titles = { name: "Ім’я", email: "Електронна пошта", phone: "Телефон", topic: "Тема звернення", message: "Повідомлення", agreement: "Згода" };
  const touched = new Set();
  let submitted = false, busy = false, startedAt = performance.now(), countTimer, priorFocus = submit;
  const size = (text) => Array.from(text).length;
  const PHONE = /^\+380\d{9}$/;
  const EMAIL = /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const normalizePhone = (raw) => {
    if (!/^[+0-9\s()-]+$/.test(raw)) return "";
    const compact = raw.replace(/[\s()-]/g, "");
    const value = /^0\d{9}$/.test(compact) ? "+38" + compact : compact;
    return value.length === 13 && PHONE.test(value) ? value : "";
  };

  // Visible cards and structured data use the same existing footer configuration.
  const set = (selector, value, href) => {
    if (!value) return;
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value; if (href) el.href = href; });
  };
  set("[data-contact-phone]", contact.phone, contact.phoneHref);
  document.querySelectorAll("[data-contact-call]").forEach((el) => { if (contact.phoneHref) el.href = contact.phoneHref; });
  set("[data-contact-email]", contact.email, contact.email ? "mailto:" + contact.email : "");
  set("[data-contact-address]", contact.address); set("[data-contact-hours]", contact.hours);
  document.querySelectorAll("[data-contact-social]").forEach((el) => {
    const url = contact.socials?.[el.dataset.contactSocial];
    if (url && /^https:\/\//.test(url)) el.href = url;
  });
  const schema = byId("contactSchema");
  if (schema) {
    const data = JSON.parse(schema.textContent), business = data["@graph"].find((item) => item["@type"] === "LocalBusiness");
    if (contact.phoneHref) business.telephone = contact.phoneHref.replace(/^tel:/, "");
    if (contact.email) business.email = contact.email;
    if (contact.address) business.address = { "@type": "PostalAddress", addressCountry: "UA", streetAddress: contact.address };
    business.sameAs = [contact.socials?.instagram, contact.socials?.facebook].filter(Boolean);
    schema.textContent = JSON.stringify(data);
  }

  const copy = byId("copyEmail"), copyStatus = byId("copyStatus");
  copy.hidden = false;
  copy.addEventListener("click", async () => {
    const email = contact.email || document.querySelector("[data-contact-email]").textContent;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email); copyStatus.textContent = "Скопійовано";
    } catch { copyStatus.textContent = "Не вдалося скопіювати. Виділіть адресу й скопіюйте її вручну."; }
  });

  function issue(key) {
    const value = fields[key].value.trim();
    switch (key) {
      case "name": return size(value) >= 2 && size(value) <= 80 ? "" : "Введіть ім’я від 2 до 80 символів.";
      case "email": {
        const local = value.split("@")[0];
        return value.length <= 254 && local.length <= 64 && EMAIL.test(value) && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") ? "" : "Перевірте адресу, наприклад name@example.com.";
      }
      case "phone": return normalizePhone(fields.phone.value) ? "" : "Введіть номер +380XXXXXXXXX або 0XXXXXXXXX. Перевірте кількість цифр.";
      case "topic": return ["order", "coffee", "wholesale", "partnership", "other"].includes(value) ? "" : "Оберіть тему звернення.";
      case "message": return size(value) >= 10 && size(value) <= 2000 ? "" : "Напишіть повідомлення від 10 до 2000 символів.";
      case "agreement": return fields.agreement.checked ? "" : "Підтвердьте ознайомлення з політикою конфіденційності.";
      default: return "";
    }
  }
  function renderField(key, neutral = false) {
    const input = fields[key], error = byId(key + "Error"), message = neutral ? "" : issue(key);
    input.setAttribute("aria-invalid", String(Boolean(message)));
    if (neutral) delete input.closest(".mo-contact-field").dataset.state;
    else input.closest(".mo-contact-field").dataset.state = message ? "error" : "success";
    if (error.textContent !== message) error.textContent = message;
    error.hidden = !message;
    return message;
  }
  function renderSummary(focus = false) {
    const invalid = Object.keys(fields).filter((key) => issue(key));
    summaryList.replaceChildren();
    for (const key of invalid) {
      const li = document.createElement("li"), link = document.createElement("a");
      link.href = "#" + fields[key].id; link.textContent = titles[key] + ": " + issue(key);
      link.addEventListener("click", (event) => { event.preventDefault(); fields[key].focus(); });
      li.append(link); summaryList.append(li);
    }
    summary.hidden = !invalid.length;
    if (focus && invalid.length) summary.focus();
    return invalid;
  }

  const suggestion = byId("emailSuggestion"), suggestionText = byId("emailSuggestionText"), suggestionButton = byId("acceptEmailSuggestion");
  const fixes = { "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmail.con": "gmail.com", "outlok.com": "outlook.com", "yaho.com": "yahoo.com" };
  let suggestedEmail = "";
  function emailHint() {
    const value = fields.email.value.trim(), at = value.lastIndexOf("@"), domain = value.slice(at + 1).toLowerCase();
    suggestedEmail = at > 0 && fixes[domain] ? value.slice(0, at + 1) + fixes[domain] : "";
    suggestion.hidden = !suggestedEmail;
    suggestionText.textContent = suggestedEmail ? "Може, ви мали на увазі " + fixes[domain] + "?" : "";
    suggestionButton.textContent = suggestedEmail ? "Використати " + suggestedEmail : "";
  }
  suggestionButton.addEventListener("click", () => {
    if (!suggestedEmail) return;
    fields.email.value = suggestedEmail; touched.add("email"); renderField("email"); emailHint();
    if (submitted) renderSummary(); fields.email.focus();
  });
  function updateMessage() {
    clearTimeout(countTimer);
    countTimer = setTimeout(() => {
      const count = size(fields.message.value), counter = byId("messageCount");
      counter.textContent = count + " / 2000"; counter.dataset.overLimit = String(count > 2000);
    }, 400);
    fields.message.style.height = "auto";
    fields.message.style.height = Math.min(420, Math.max(160, fields.message.scrollHeight)) + "px";
  }
  for (const [key, input] of Object.entries(fields)) {
    const error = byId(key + "Error"); error.setAttribute("aria-live", "polite"); error.setAttribute("aria-atomic", "true");
    input.addEventListener("blur", () => {
      if (busy) return;
      touched.add(key); renderField(key);
      if (key === "email") emailHint();
      if (submitted) renderSummary();
    });
    input.addEventListener("input", () => {
      sendError.hidden = true;
      if (key === "message") updateMessage();
      if (key === "email") { suggestion.hidden = true; suggestedEmail = ""; }
      if (touched.has(key)) renderField(key);
      if (submitted) renderSummary();
    });
    if (input.tagName === "SELECT" || key === "agreement") input.addEventListener("change", () => {
      touched.add(key); renderField(key); if (submitted) renderSummary();
    });
  }

  function setBusy(value) {
    busy = value; submit.disabled = value; retry.disabled = value;
    form.setAttribute("aria-busy", String(value)); submit.setAttribute("aria-busy", String(value));
    label.textContent = value ? "Надсилаємо…" : "Надіслати";
    submit.querySelector(".mo-contact-spinner").hidden = !value;
    // Prevent editing data while a particular payload is being processed.
    Object.values(fields).forEach((input) => { input.disabled = value; });
  }
  function showSendError(message, canRetry = true) {
    sendErrorText.textContent = message; retry.hidden = !canRetry;
    sendError.hidden = false; sendError.focus();
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (busy || modal.open) return;
    submitted = true; Object.keys(fields).forEach((key) => { touched.add(key); renderField(key); });
    const invalid = renderSummary(true); if (invalid.length) return;
    if (byId("website").value || performance.now() - startedAt < CONFIG.minFillMs) {
      showSendError("Перевірте введені дані й спробуйте ще раз за кілька секунд.", false); return;
    }
    const payload = { name: fields.name.value.trim(), email: fields.email.value.trim(), phone: normalizePhone(fields.phone.value), topic: fields.topic.value, message: fields.message.value.trim(), agreement: fields.agreement.checked };
    // Normalize visibly only at submission, after accepting flexible input formats.
    fields.phone.value = payload.phone;
    priorFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : submit;
    sendError.hidden = true; setBusy(true);
    try {
      if (CONFIG.mode === "live") {
        if (!CONFIG.endpoint) throw new Error("Missing endpoint");
        const endpoint = new URL(CONFIG.endpoint, location.href);
        if (!["https:", "http:"].includes(endpoint.protocol)) throw new Error("Invalid endpoint");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
        try {
          const response = await fetch(endpoint.href, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload), signal: controller.signal, credentials: "omit" });
          if (!response.ok) throw new Error("Delivery failed");
        } finally { clearTimeout(timeout); }
      } else if (CONFIG.mode === "demo") {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.demoDelayMs));
      } else throw new Error("Unknown mode");
      byId("success-title").textContent = CONFIG.mode === "demo" ? "Дякуємо! Форму перевірено." : "Дякуємо! Повідомлення надіслано.";
      byId("success-description").textContent = CONFIG.mode === "demo" ? "Це демонстрація успішного надсилання. Дані не передавалися на сервер." : "Ми отримали ваше звернення. Відповімо протягом робочого дня.";
      setBusy(false); modal.showModal(); document.documentElement.classList.add("mo-contact-scroll-lock"); form.reset();
    } catch {
      setBusy(false); showSendError("Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.");
    }
  });
  retry.addEventListener("click", () => { if (!busy) form.requestSubmit(); });
  form.addEventListener("reset", () => {
    touched.clear(); submitted = false; startedAt = performance.now(); summary.hidden = true; summaryList.replaceChildren();
    sendError.hidden = true; suggestion.hidden = true; suggestedEmail = ""; clearTimeout(countTimer);
    Object.keys(fields).forEach((key) => renderField(key, true));
    queueMicrotask(() => { byId("messageCount").textContent = "0 / 2000"; byId("messageCount").dataset.overLimit = "false"; fields.message.style.height = ""; });
  });
  byId("closeModalBtn").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    const r = modal.getBoundingClientRect();
    if (event.target === modal && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) modal.close();
  });
  modal.addEventListener("close", () => {
    document.documentElement.classList.remove("mo-contact-scroll-lock");
    const trigger = priorFocus?.isConnected && !priorFocus.disabled ? priorFocus : submit;
    trigger.focus({ preventScroll: true });
  });
  form.noValidate = true; form.setAttribute("aria-busy", "false"); submit.disabled = false;
})();
