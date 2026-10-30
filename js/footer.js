/* Shared footer presentation. Newsletter submission stays disabled until a service is connected. */
(() => {
  "use strict";
  const footer = document.querySelector(".mo-footer");
  if (!footer) return;
  const config = window.CoffeeFooterConfig || {};
  const phone = footer.querySelector("[data-mo-footer-phone]"),
    email = footer.querySelector("[data-mo-footer-email]");
  if (config.phone && config.phoneHref) {
    phone.textContent = config.phone;
    phone.href = config.phoneHref;
  }
  if (config.email) {
    email.textContent = config.email;
    email.href = "mailto:" + config.email;
  }
  for (const key of ["address", "hours"])
    if (config[key]) footer.querySelector(`[data-mo-footer-${key}]`).textContent = config[key];
  for (const link of footer.querySelectorAll("[data-mo-footer-social]")) {
    const url = config.socials?.[link.dataset.moFooterSocial];
    if (url && /^(https:\/\/|viber:\/\/)/.test(url)) link.href = url;
  }
  const updateYear = () => {
    footer.querySelector("[data-mo-footer-year]").textContent = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
    }).format(new Date());
  };
  updateYear();
  addEventListener("pageshow", updateYear);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateYear();
  });
  footer.querySelector(".mo-footer-newsletter").hidden = true;
  const form = footer.querySelector("form"),
    input = form.querySelector('input[type="email"]'),
    error = footer.querySelector(".mo-footer-error");
  function validate() {
    const invalid = input.value.trim() && !input.validity.valid;
    error.hidden = !invalid;
    error.textContent = invalid ? "Перевір адресу, наприклад name@example.com." : "";
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  input.addEventListener("blur", validate);
  input.addEventListener("input", () => {
    if (input.hasAttribute("aria-invalid")) validate();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validate();
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      validate();
    }
  });
  const motion = matchMedia("(prefers-reduced-motion:no-preference)");
  const up = footer.querySelector(".mo-footer-up");
  up.hidden = false;
  up.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: motion.matches ? "smooth" : "instant" });
    document.querySelector('header a[href$="index.html"]')?.focus({ preventScroll: true });
  });
  if ("IntersectionObserver" in window) {
    const presence = new IntersectionObserver((entries) => {
      document.body.classList.toggle("mo-footer-in-view", entries[0].isIntersecting);
    });
    presence.observe(footer);
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("mo-footer-visible");
            reveal.unobserve(entry.target);
          }
      },
      { threshold: 0.06, rootMargin: "0px 0px 30px 0px" },
    );
    footer.querySelectorAll("[data-mo-footer-reveal]").forEach((el, index) => {
      if (!motion.matches || el.getBoundingClientRect().top < innerHeight) return;
      el.style.setProperty("--mo-footer-delay", `${Math.min(index, 3) * 45}ms`);
      el.classList.add("mo-footer-reveal");
      reveal.observe(el);
    });
    footer.addEventListener("focusin", (event) => {
      event.target.closest(".mo-footer-reveal")?.classList.add("mo-footer-visible");
    });
    motion.addEventListener("change", () => {
      if (!motion.matches)
        footer
          .querySelectorAll(".mo-footer-reveal")
          .forEach((el) => el.classList.add("mo-footer-visible"));
    });
  }
})();
