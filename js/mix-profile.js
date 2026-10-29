/* Presentation of the existing illustrative taste model; no new taste measurements. */
(() => {
  "use strict";
  const S = window.CoffeeShop;
  if (!S) return;
  const n = S.node;
  const format = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 });
  const level = (value) => (value < 4 ? "Низька" : value < 7 ? "Помірна" : "Висока");
  const strengthLevel = (value) => (value < 4 ? "Легка" : value < 7 ? "Середня" : "Висока");

  function describe(m, taste) {
    const acidity = taste.acidity / 10,
      sweetness = taste.sweetness / 10,
      bitterness = taste.bitterness / 10;
    const acidWord = acidity < 4 ? "м’якою" : acidity < 7 ? "помірною" : "виразною";
    const sweetWord = sweetness < 4 ? "стриманою" : sweetness < 7 ? "помірною" : "виразною";
    const bitterWord = bitterness < 4 ? "легкою" : bitterness < 7 ? "помірною" : "виразною";
    const scores = [acidity, sweetness, bitterness];
    const base =
      Math.max(...scores) - Math.min(...scores) <= 1
        ? "Збалансований профіль кислотності, солодкості й гіркоти"
        : sweetness >= acidity && sweetness >= bitterness
          ? `Солодкий профіль із ${acidWord} кислотністю`
          : acidity >= bitterness
            ? `Яскравий профіль із ${sweetWord} солодкістю`
            : `Насичений профіль із ${bitterWord} гіркотою та ${acidWord} кислотністю`;
    const notes = [...m.beans]
      .filter((bean) => bean.ratio > 0)
      .sort((a, b) => b.ratio - a.ratio)
      .map((bean) => {
        const product = S.byId.get(bean.id);
        const text = S.isGreen(product)
          ? product.notesByRoast?.[S.beanRoast(bean)] || product.notes
          : product.notes;
        return text
          .split(/[.;]/)[0]
          .split(/[,;]|\s+(?:і|й|та)\s+/u)
          .map((part) => part.trim().toLocaleLowerCase("uk"))
          .filter((part) => part && !/ноти|профіль|орієнтир/u.test(part));
      });
    const prominent = [
      ...new Set(
        [...notes.map((parts) => parts[0]), ...notes.flatMap((parts) => parts.slice(1))].filter(
          Boolean,
        ),
      ),
    ].slice(0, 2);
    return `${base}${prominent.length ? `; у нотах — ${prominent.join(" та ")}` : ""}.`;
  }

  function mount(element) {
    element.classList.add("mix-taste-profile", "is-empty");
    const strengthFill = n("span", {class:"mix-profile-fill mo-mix-strength-fill",style:"width:100%;transform:scaleX(0)"});
    const strengthTrack = n("div", {class:"mix-profile-track","aria-hidden":"true"}, strengthFill,
      ...[25,50,75].map(percent=>n("span",{class:"mix-profile-tick",style:`left:${percent}%`})));
    const strengthValue = n("span", {
      class: "mix-profile-value",
      "aria-hidden": "true",
      text: "—",
    });
    const strengthWord = n("span", { class: "mix-profile-level", hidden: true });
    const strengthAccessible = n("meter", {
      class:"mix-profile-meter visually-hidden", min:0, max:10, value:0,
      "aria-label":"Міцність", "aria-describedby":"mix-profile-help", hidden:true,
    });
    const strengthRow = n(
      "div",
      { class: "mix-profile-strength mo-mix-strength-row" },
      n("div", { class: "mix-profile-label" }, n("span", { text: "Міцність" }), strengthWord),
      n("div", { class: "mix-profile-meter-cell" }, strengthAccessible, strengthTrack),
      strengthValue,
    );
    const noticeText = n("span");
    const noticeDetail = n("span", { class: "mix-profile-notice-detail" });
    const notice = n(
      "div",
      { class: "mix-profile-notice", role: "status", "aria-live": "polite", "aria-atomic": "true" },
      n("i", { class: "fa-solid fa-mug-hot icon", "aria-hidden": "true" }),
      n("span", { class: "mix-profile-notice-copy" }, noticeText, noticeDetail),
    );
    const scale = n(
      "div",
      { class: "mix-profile-scale", "aria-hidden": "true", hidden: true },
      n("span"),
      n(
        "span",
        { class: "mix-profile-scale-marks" },
        ...[25, 50, 75].map((percent) =>
          n("span", { style: `left:${percent}%`, text: `${percent}%` }),
        ),
      ),
      n("span", { class: "mix-profile-scale-range", text: "0–10" }),
    );
    const rows = Object.entries(S.tasteDimensions).map(([key, label]) => {
      const labelId = `mix-${key}-label`;
      const word = n("span", { class: "mix-profile-level", hidden: true });
      const meter = n("meter", {
        class: "mix-profile-meter visually-hidden",
        id: `mix-${key}-meter`,
        min: 0,
        max: 10,
        value: 0,
        "aria-labelledby": labelId,
        "aria-describedby": "mix-profile-help",
        hidden: true,
      });
      const fill = n("span", { class: "mix-profile-fill", style: "width:0%" });
      const track = n(
        "div",
        { class: "mix-profile-track", "aria-hidden": "true" },
        fill,
        ...[25, 50, 75].map((percent) =>
          n("span", { class: "mix-profile-tick", style: `left:${percent}%` }),
        ),
      );
      const value = n("span", { class: "mix-profile-value", "aria-hidden": "true", text: "—" });
      const row = n(
        "div",
        { class: "mix-profile-row", "data-profile-dimension": key },
        n("div", { class: "mix-profile-label" }, n("span", { id: labelId, text: label }), word),
        n("div", { class: "mix-profile-meter-cell" }, meter, track),
        value,
      );
      return { key, meter, fill, value, word, row };
    });
    const description = n("p", {
      id: "mix-profile-description",
      class: "mix-profile-description",
      hidden: true,
    });
    const notesTitle = n("h4", {
      class: "mix-summary-subheading",
      text: "Смакові ноти",
      hidden: true,
    });
    const notesList = n("ul", { class: "mix-flavor-notes", id: "mix-notes", hidden: true });
    element.replaceChildren(
      n(
        "div",
        { class: "mix-profile-heading" },
        n("h3", {
          id: "mix-profile-title",
          class: "mix-summary-subheading",
          text: "Смаковий профіль",
        }),
        n("span", {
          class: "mix-profile-estimate",
          text: "орієнтовно",
          title: "Орієнтовна оцінка за складом і обсмаженням",
        }),
      ),
      notice,
      n(
        "div",
        { id: "mix-profile-chart", class: "mix-profile-chart" },
        scale,
        rows.map((entry) => entry.row),
        strengthRow,
      ),
      n("p", {
        id: "mix-profile-help",
        class: "visually-hidden",
        text: "Орієнтовна оцінка за складом і обсмаженням. Шкала від 0 до 10. Поділки 25%, 50% і 75% відповідають оцінкам 2,5; 5 та 7,5.",
      }),
      description,
      notesTitle,
      notesList,
    );
    return Object.freeze({
      update(m, ready, taste) {
        const available = Boolean(taste) && ready;
        element.classList.toggle("is-empty", !available);
        notice.hidden = available;
        scale.hidden = !available;
        const message = !m.beans.length
          ? "Додайте сорти, щоб побачити профіль"
          : !ready
            ? "Налаштуйте частки до 100%, щоб побачити профіль"
            : "Для цього складу ще немає оцінок смаку";
        if (noticeText.textContent !== message) noticeText.textContent = message;
        const detail = !m.beans.length
          ? "Оцінка з’явиться за суми часток 100%."
          : !ready
            ? ""
            : "Спробуйте інший склад.";
        if (noticeDetail.textContent !== detail) noticeDetail.textContent = detail;
        noticeDetail.hidden = !detail;
        for (const row of rows) {
          const score = available ? taste[row.key] / 10 : 0;
          row.meter.hidden = !available;
          row.meter.value = score;
          row.value.textContent = available ? format.format(score) : "—";
          row.word.hidden = false;
          row.word.textContent = available ? level(score) : "—";
          row.fill.style.width = `${score * 10}%`;
          if (available) {
            const text = `${format.format(score)} з 10, ${level(score).toLocaleLowerCase("uk")}`;
            row.meter.textContent = text;
            row.meter.setAttribute("aria-valuetext", text);
          } else {
            row.meter.textContent = "Оцінка недоступна";
            row.meter.removeAttribute("aria-valuetext");
          }
        }
        const strength = available
          ? Math.round(
              m.beans.reduce((sum, bean) => sum + S.beanStrength(bean) * bean.ratio, 0) / 50,
            )
          : 0;
        strengthValue.textContent = available ? format.format(strength) : "—";
        strengthWord.hidden = false;
        strengthWord.textContent = available ? strengthLevel(strength) : "—";
        strengthAccessible.textContent = available
          ? `${strength} з 10; ${strengthLevel(strength).toLocaleLowerCase("uk")} смакова інтенсивність`
          : "Оцінка міцності недоступна";
        strengthAccessible.hidden = !available;
        strengthAccessible.value = strength;
        if (available) strengthAccessible.setAttribute("aria-valuetext", `${strength} з 10; ${strengthLevel(strength).toLocaleLowerCase("uk")} смакова інтенсивність`);
        else strengthAccessible.removeAttribute("aria-valuetext");
        strengthFill.style.transform = `scaleX(${strength/10})`;
        description.hidden = false;
        description.dataset.placeholder = String(!available);
        description.textContent = available
          ? describe(m, taste)
          : "Тут з’явиться короткий опис смаку вашого міксу.";
        const active = m.beans.filter((bean) => bean.ratio > 0);
        notesTitle.hidden = notesList.hidden = !active.length;
        notesList.replaceChildren(
          ...active.map((bean) => {
            const product = S.byId.get(bean.id);
            const text = S.isGreen(product)
              ? product.notesByRoast?.[S.beanRoast(bean)] || product.notes
              : product.notes;
            return n(
              "li",
              {},
              n("strong", { text: product.name }),
              n("span", { text: text.split(".")[0] }),
            );
          }),
        );
      },
    });
  }
  window.CoffeeMixProfile = Object.freeze({ mount });
})();
