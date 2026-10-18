/* Сторонні медіасервіси завантажуються тільки після свідомого натискання. */
(() => {
  for (const button of document.querySelectorAll("button[data-embed]")) {
    button.addEventListener(
      "click",
      () => {
        const template = document.getElementById(button.dataset.embed);
        if (!(template instanceof HTMLTemplateElement)) return;
        const frame = template.content.querySelector("iframe")?.cloneNode(true);
        if (!frame) return;
        button.replaceWith(frame);
        frame.focus({ preventScroll: true });
      },
      { once: true },
    );
  }
})();
