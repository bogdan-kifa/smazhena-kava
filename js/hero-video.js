// Власна кнопка доповнює відео; без JavaScript доступні стандартні controls.
(() => {
  const video = document.querySelector("#hero-video");
  const toggle = document.querySelector(".hero-video-toggle");

  if (!video || !toggle) return;

  const label = toggle.querySelector(".hero-video-toggle-label");
  const icon = toggle.querySelector(".icon");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactScreen = window.matchMedia("(max-width: 767px)");

  // Назва описує наступну дію та завжди відповідає фактичному стану відео.
  function syncControl() {
    const paused = video.paused || video.ended;
    label.textContent = paused ? "Відтворити відео" : "Пауза відео";
    toggle.title = label.textContent;
    icon.classList.toggle("fa-play", paused);
    icon.classList.toggle("fa-pause", !paused);
  }

  function playVideo() {
    // Якщо браузер блокує запуск, залишається доступна кнопка відтворення.
    video.play().catch(syncControl);
  }

  toggle.addEventListener("click", () => {
    if (video.paused || video.ended) {
      playVideo();
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", syncControl);
  video.addEventListener("pause", syncControl);
  video.addEventListener("ended", syncControl);

  // Увімкнення зменшеного руху зупиняє відео; поновити можна свідомо кнопкою.
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) video.pause();
  });
  compactScreen.addEventListener("change", (event) => {
    if (event.matches) video.pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });

  video.controls = false;
  toggle.hidden = false;
  syncControl();

  // Атрибута autoplay немає: так відео не стартує до перевірки налаштувань.
  // На телефоні та при економії трафіку спершу показуємо постер; loop працює після запуску.
  if (!reducedMotion.matches && !compactScreen.matches && !navigator.connection?.saveData) {
    requestAnimationFrame(() => requestAnimationFrame(playVideo));
  }
})();
