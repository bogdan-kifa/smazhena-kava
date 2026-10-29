/* Review cards scroll natively by touch, scrollbar, buttons and keyboard. */
(() => {
  "use strict";
  const list = document.getElementById("home-reviews-carousel");
  if (!list) return;
  const previous = document.getElementById("reviews-previous"),
    next = document.getElementById("reviews-next"),
    position = document.getElementById("reviews-position"),
    controls = document.getElementById("reviews-controls"),
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  controls.hidden = false;
  const step = () =>
    list.firstElementChild.getBoundingClientRect().width +
    (parseFloat(getComputedStyle(list).columnGap) || 0);
  const scroll = (direction) =>
    list.scrollBy({
      left: direction * step(),
      behavior: reducedMotion.matches ? "instant" : "smooth",
    });
  previous.addEventListener("click", () => scroll(-1));
  next.addEventListener("click", () => scroll(1));
  list.addEventListener("keydown", (event) => {
    if (event.target !== list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    if (event.key === "ArrowLeft") scroll(-1);
    else if (event.key === "ArrowRight") scroll(1);
    else
      list.scrollTo({
        left: event.key === "Home" ? 0 : list.scrollWidth,
        behavior: reducedMotion.matches ? "instant" : "smooth",
      });
  });
  function sync() {
    const index = Math.round(list.scrollLeft / step()),
      visible = Math.max(1, Math.round(list.clientWidth / step())),
      first = index + 1,
      last = Math.min(list.children.length, index + visible),
      text = `${first === last ? first : `${first}–${last}`} із ${list.children.length}`;
    if (position.textContent !== text) position.textContent = text;
    previous.disabled = list.scrollLeft < 2;
    next.disabled = list.scrollLeft >= list.scrollWidth - list.clientWidth - 2;
  }
  let timer;
  list.addEventListener(
    "scroll",
    () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 120);
    },
    { passive: true },
  );
  new ResizeObserver(sync).observe(list);
  sync();
})();
