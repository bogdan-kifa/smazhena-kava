/* Explicit handoff from a recommendation; existing drafts require replacement consent. */
(() => {
  "use strict";
  const S = window.CoffeeShop,
    params = new URLSearchParams(location.search),
    raw = params.get("mix");
  if (!raw) return;
  const n = S.node,
    parts = raw.split(":");
  const product = parts.length === 2 && parts[1] === "100" ? S.byId.get(parts[0]) : null;
  const cleaned = new URL(location.href);
  for (const key of ["mix", "weight", "grind"]) cleaned.searchParams.delete(key);
  function cancel() {
    cleaned.searchParams.delete("save");
    history.replaceState(history.state, "", cleaned);
  }
  if (!product || S.isGreen(product)) {
    cancel();
    S.notify("Не вдалося відкрити сорт із посилання. Оберіть каву в конструкторі.");
    return;
  }
  const error = n("p", { class: "account-error", role: "alert", hidden: true });
  const dialog = n("dialog", { class: "account-dialog", "aria-labelledby": "quiz-import-title" });
  const apply = n("button", { class: "button", type: "button", text: "Відкрити цей склад" });
  const keep = n("button", {
    class: "button button-secondary",
    type: "button",
    text: "Залишити поточний мікс",
  });
  let replacing = false,
    accepted = false;
  async function importRecipe() {
    if (replacing) return;
    replacing = true;
    apply.disabled = keep.disabled = true;
    error.hidden = true;
    try {
      const ok = await S.update((state) => {
        state.draft = {
          ...S.emptyMix(),
          beans: [{ id: product.id, ratio: 100, slot: 0 }],
          weight: [250, 500, 1000].includes(Number(params.get("weight")))
            ? Number(params.get("weight"))
            : 250,
          grind: ["espresso", "filter", "cezve"].includes(params.get("grind"))
            ? params.get("grind")
            : S.emptyMix().grind,
        };
      });
      if (ok) {
        accepted = true;
        location.replace(cleaned.href);
        return;
      }
      error.textContent =
        "Не вдалося зберегти склад для переходу. Поточна сторінка залишається доступною.";
      error.hidden = false;
    } catch {
      error.textContent = "Не вдалося відкрити склад. Спробуйте ще раз.";
      error.hidden = false;
    } finally {
      replacing = false;
      apply.disabled = keep.disabled = false;
    }
  }
  apply.addEventListener("click", importRecipe);
  keep.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (replacing) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    if (!accepted) cancel();
    dialog.remove();
  });
  dialog.append(
    n("h2", {
      id: "quiz-import-title",
      text: S.get().draft.beans.length
        ? "Замінити поточний мікс?"
        : "Відкрити сорт у конструкторі?",
    }),
    n("p", { text: `${product.name} — 100%. Після відкриття можна змінити склад, вагу й помел.` }),
    ...(params.get("grind") === "beans" ? [n("p", { text: "Ви обрали каву в зернах. У конструкторі мікс замовляють із помелом: початково встановимо «Фільтр», його можна змінити. Для покупки без помелу поверніться до результату квізу." })] : []),
    error,
    n("div", { class: "account-dialog-actions" }, apply, keep),
  );
  // Always show the explicit handoff so an old browser-history link cannot overwrite edits.
  document.body.append(dialog);
  dialog.showModal();
  apply.focus();
})();
