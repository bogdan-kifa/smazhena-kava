/* Lab 10: isolated presentation components. Commerce scripts keep their own state. */
(() => {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const options = { reviews: true, gallery: true, typed: true, ...window.CoffeeMediaConfig };
  let reviews = null, typed = null;
  let inView = false, hovered = false, focused = false, galleryOpen = false;
  const byId = (id) => document.getElementById(id);

  function syncReviews() {
    if (!reviews) return;
    const stop = motion.matches || hovered || focused || galleryOpen || document.hidden || !inView;
    if (stop) reviews.autoplay.stop();
    else if (!reviews.autoplay.running) reviews.autoplay.start();
    byId("reviews-position").setAttribute("aria-live", focused ? "polite" : "off");
  }

  function initReviews() {
    const element = byId("home-reviews-slider");
    if (!options.reviews || !element || typeof window.Swiper !== "function") return;
    if (!document.querySelector('[data-mo-library="swiper-css"]')?.sheet) return;
    element.classList.add("mo-media-ready");
    const total = element.querySelectorAll(".swiper-slide").length;
    const syncPosition = (instance) => {
      byId("reviews-position").textContent = `${instance.realIndex + 1} з ${total} відгуків`;
    };
    reviews = new Swiper(element, {
      loop: total >= 6,
      slidesPerView: 1,
      spaceBetween: 24,
      speed: motion.matches ? 0 : 420,
      autoplay: { delay: 3500, disableOnInteraction: false, pauseOnMouseEnter: true },
      breakpoints: { 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } },
      navigation: { prevEl: byId("reviews-previous"), nextEl: byId("reviews-next") },
      pagination: {
        el: byId("reviews-pagination"), clickable: true,
        renderBullet: (index, className) => `<button type="button" class="${className}" aria-label="Відгук ${index + 1}"></button>`,
      },
      keyboard: { enabled: true, onlyInViewport: true, pageUpDown: false },
      a11y: {
        enabled: true, prevSlideMessage: "Попередній відгук", nextSlideMessage: "Наступний відгук",
        firstSlideMessage: "Перший відгук", lastSlideMessage: "Останній відгук",
        paginationBulletMessage: "Перейти до відгуку {{index}}", slideLabelMessage: "{{index}} з {{slidesLength}}",
        containerRoleDescriptionMessage: "Слайдер відгуків", itemRoleDescriptionMessage: "Відгук",
      },
      on: { init: syncPosition, slideChange: syncPosition },
    });
    byId("reviews-controls").hidden = false;
    byId("reviews-pagination").hidden = false;
    byId("reviews-previous").disabled = false;
    element.addEventListener("mouseenter", () => { hovered = true; syncReviews(); });
    element.addEventListener("mouseleave", () => { hovered = false; syncReviews(); });
    const section = byId("reviews");
    section.addEventListener("focusin", () => { focused = true; syncReviews(); });
    section.addEventListener("focusout", () => queueMicrotask(() => {
      focused = section.contains(document.activeElement); syncReviews();
    }));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting && entry.intersectionRatio >= .2; syncReviews(); }, { threshold: .2 }).observe(element);
    } else inView = true;
    motion.addEventListener("change", () => { reviews.params.speed = motion.matches ? 0 : 420; syncReviews(); });
    syncReviews();
  }

  function galleryOptions() {
    const nameButtons = () => {
      document.querySelectorAll(".fancybox__container button[title]").forEach((button) => {
        button.setAttribute("aria-label", button.getAttribute("title"));
      });
    };
    return {
      animated: !motion.matches,
      showClass: motion.matches ? false : "f-fadeIn",
      hideClass: motion.matches ? false : "f-fadeOut",
      trapFocus: true, placeFocusBack: true, autoFocus: true,
      contentClick: "iterateZoom", contentDblClick: "toggleZoom",
      Carousel: { infinite: true, transition: motion.matches ? false : "fade" },
      Images: { zoom: !motion.matches, Panzoom: { maxScale: 3 } },
      Toolbar: { display: { left: ["infobar"], middle: [], right: ["iterateZoom", "fullscreen", "close"] } },
      Thumbs: false, Slideshow: false, Hash: false,
      l10n: {
        CLOSE: "Закрити", NEXT: "Наступне фото", PREV: "Попереднє фото", MODAL: "Перегляд зображень",
        ERROR: "Не вдалося відкрити зображення. Спробуйте ще раз.", IMAGE_ERROR: "Зображення не завантажилося.",
        TOGGLE_ZOOM: "Змінити масштаб", ITERATEZOOM: "Збільшити зображення", TOGGLEZOOM: "Змінити масштаб",
        TOGGLE_FULLSCREEN: "На весь екран", TOGGLEFS: "На весь екран", DOWNLOAD: "Завантажити",
      },
      on: {
        init: () => { galleryOpen = true; syncReviews(); syncTyped(); },
        ready: nameButtons,
        done: nameButtons,
        destroy: () => { galleryOpen = false; syncReviews(); syncTyped(); },
      },
    };
  }
  function bindGallery() {
    if (!options.gallery || !document.querySelector('[data-fancybox="coffee-gallery"]') || !window.Fancybox) return;
    // An unstyled overlay is less useful than the ordinary image link fallback.
    if (!document.querySelector('[data-mo-library="fancybox-css"]')?.sheet) return;
    Fancybox.defaults.Hash = false;
    Fancybox.unbind('[data-fancybox="coffee-gallery"]');
    Fancybox.bind('[data-fancybox="coffee-gallery"]', galleryOptions());
  }

  function syncTyped() {
    if (!typed) return;
    if (document.hidden || galleryOpen) typed.stop();
    else typed.start();
  }
  function initTyped() {
    const target = byId("mo-media-typed");
    if (!target) return;
    if (typed) { typed.destroy(); typed = null; }
    target.textContent = "під свій смак";
    if (!options.typed || motion.matches || typeof window.Typed !== "function") return;
    typed = new Typed(target, {
      strings: ["під свій смак", "за власним рецептом", "для свого ритму"],
      typeSpeed: 55, backSpeed: 30, startDelay: 700, backDelay: 2200,
      smartBackspace: true, loop: true, showCursor: false, autoInsertCss: false, contentType: "null",
    });
    syncTyped();
  }

  function initialize() {
    initReviews(); bindGallery(); initTyped();
    motion.addEventListener("change", () => { initTyped(); bindGallery(); });
    document.addEventListener("visibilitychange", () => { syncReviews(); syncTyped(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
