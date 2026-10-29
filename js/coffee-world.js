/* Standalone educational coffee atlas; no shop or catalogue dependencies. */
(() => {
  "use strict";
  const root = document.getElementById("coffee-world");
  if (!root) return;
  const assetBase = new URL("../", document.currentScript.src);
  const assetURL = (path) => new URL(path, assetBase).href;
  const $ = (id) => document.getElementById("mo-world-" + id);
  const stage = $("stage"),
    select = $("country"),
    profile = $("profile"),
    legend = $("legend"),
    status = $("count"),
    card = $("country-card"),
    home = $("country-home"),
    sheet = $("sheet"),
    sheetContent = $("sheet-content"),
    mobile = matchMedia("(max-width:767px)");
  const n = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "text") el.textContent = value;
      else el.setAttribute(key, value);
    }
    el.append(...children);
    return el;
  };
  const names = {
    all: "Усі види",
    arabica: "Арабіка",
    robusta: "Робуста",
    liberica: "Ліберіка",
    excelsa: "Ексельза",
    compare: "Арабіка vs Робуста",
  };
  const profiles = {
    all: {
      title: "Кавовий пояс світу",
      text: "Основні врожаї зосереджені поблизу екватора. Колір показує обсяг виробництва, а вибір країни відкриває довідку про вирощування.",
      tags: ["Арабіка й робуста — обсяги USDA", "Ліберіка й ексельза — географія"],
    },
    arabica: {
      title: "Арабіка · Coffea arabica",
      text: "Арабіка — кава з виразною кислотністю та часто фруктовими або квітковими нотами.",
      tags: ["Типово: 600–2000 м", "Фільтр та еспресо"],
    },
    robusta: {
      title: "Робуста · Coffea canephora",
      text: "Робуста — щільніше тіло, виразніша гіркота та зазвичай більше кофеїну, ніж в арабіці.",
      tags: ["Типово: нижчі ділянки, до 900 м", "Щільне тіло, використовується у блендах"],
    },
    liberica: {
      title: "Ліберіка · Coffea liberica",
      text: "Ліберіка — рідкісна кава з теплих регіонів; на карті показані підтверджені місця вирощування.",
      tags: ["Теплі низинні регіони", "Обсяги окремо не оцінюємо"],
    },
    excelsa: {
      title: "Ексельза · Coffea dewevrei",
      text: "Ексельза — окремий вид кави з Африки та Азії, який раніше часто відносили до ліберіки.",
      tags: ["Приклади вирощування з наукових джерел", "Обсяги окремо не оцінюємо"],
    },
    compare: {
      title: "Два види — іноді одна країна",
      text: "Карамельний колір позначає арабіку, темний — робусту. Штриховка означає, що в обліку USDA країна має обидві категорії. Цей режим порівнює географію, а не обсяги.",
      tags: ["Арабіка", "Робуста", "Штриховка: обидві"],
    },
  };
  let data,
    svg,
    countries,
    byIso,
    paths,
    loaded = false,
    busy = false,
    mode = "arabica",
    selected = "",
    zoom = 1,
    center = [500, 200],
    pointer = null,
    ignoreClick = false;
  const point = ([lon, lat]) => [((lon + 180) * 1000) / 360, ((82 - lat) * 1000) / 360];
  const volume = (value) =>
    value >= 1000
      ? `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value / 1000)} млн мішків`
      : `${new Intl.NumberFormat("uk-UA").format(value)} тис. мішків`;
  const has = (c, s) => Boolean(c.species[s]?.present);
  const value = (c) => (mode === "all" ? c.total : c.species[mode]?.volume);
  function active(c) {
    if (mode === "all") return c.total > 0 || Object.values(c.species).some((s) => s.present);
    if (mode === "compare") return has(c, "arabica") || has(c, "robusta");
    return has(c, mode);
  }
  function readURL() {
    const params = new URLSearchParams(location.search);
    mode = ["arabica", "robusta", "liberica", "excelsa"].includes(params.get("species")) ? params.get("species") : "arabica";
    selected = params.get("country") || "";
  }
  function writeURL() {
    const url = new URL(location.href);
    mode === "all" ? url.searchParams.delete("species") : url.searchParams.set("species", mode);
    selected ? url.searchParams.set("country", selected) : url.searchParams.delete("country");
    if (url.href !== location.href) history.pushState(null, "", url);
  }
  function currentCountries() {
    return countries.filter(active).sort((a, b) => a.country.localeCompare(b.country, "uk"));
  }
  function defaultCountry() {
    const preferred = {
      all: "BRA",
      arabica: "BRA",
      robusta: "VNM",
      liberica: "MYS",
      excelsa: "UGA",
      compare: "BRA",
    }[mode];
    return byIso.has(preferred) && active(byIso.get(preferred))
      ? preferred
      : currentCountries()[0]?.iso || "";
  }
  function showPlaceholder() {
    card.hidden = false;
    card.replaceChildren(
      n("p", {class:"mo-world-eyebrow",text:names[mode]}),
      n("h3", {id:"mo-world-country-title",tabindex:"-1",text:"Натисни на країну"}),
      n("p", {class:"mo-world-small",text:"Натисни на підсвічену країну на карті. Тут з’являться дані про вирощування кави."})
    );
  }
  function renderCountry() {
    const c = byIso.get(selected);
    if (!c) return;
    const title = n("h3", { id: "mo-world-country-title", tabindex: "-1", text: c.country }),
      children = [n("p", { class: "mo-world-eyebrow", text: names[mode] }), title];
    const rareMode = ["liberica", "excelsa"].includes(mode);
    const displayedVolume = rareMode
      ? null
      : ["arabica", "robusta"].includes(mode)
        ? c.species[mode]?.volume
        : c.total;
    if (displayedVolume != null)
      children.push(
        n("p", { class: "mo-world-total", text: volume(displayedVolume) }),
        n("p", {
          class: "mo-world-small",
          text: `${["arabica", "robusta"].includes(mode) ? names[mode] : "Усього кави"} · оцінка USDA 2025/26`,
        }),
      );
    const rows = [];
    for (const id of ["arabica", "robusta"]) {
      if (rareMode) continue;
      const record = c.species[id];
      if (!record || record.volume === 0) continue;
      const amount = record.volume != null ? volume(record.volume) : "Вирощування підтверджене";
      rows.push(n("div", {}, n("dt", { text: names[id] }), n("dd", { text: amount })));
    }
    for (const id of ["liberica", "excelsa"])
      if (has(c, id) && (!rareMode || mode === id))
        rows.push(
          n("div", {}, n("dt", { text: names[id] }), n("dd", { text: "Вирощування підтверджене" })),
        );
    if (rows.length) children.push(n("dl", { class: "mo-world-numbers" }, ...rows));
    else if (c.total != null)
      children.push(
        n("p", {
          class: "mo-world-small",
          text: "Джерело подає загальний обсяг, без окремого розподілу за видами.",
        }),
      );
    const a = c.species.arabica?.volume, r = c.species.robusta?.volume;
    const pct = v => new Intl.NumberFormat("uk-UA", {maximumFractionDigits:1}).format(v*100)+"%";
    if (!rareMode && Number.isFinite(a) && Number.isFinite(r) && a+r>0) {
      children.push(n("p",{class:"mo-world-small",text:"Уся кава країни · розподіл за видами"}));
      const bar=n("div",{class:"mo-world-stack","aria-hidden":"true"});
      const left=n("span",{class:"mo-world-stack-arabica"}),right=n("span",{class:"mo-world-stack-robusta"});
      left.style.width=(a/(a+r)*100)+"%";right.style.width=(r/(a+r)*100)+"%";bar.append(left,right);
      children.push(bar,n("div",{class:"mo-world-stack-labels"},n("span",{text:"Арабіка "+pct(a/(a+r))}),n("span",{text:"Робуста "+pct(r/(a+r))})));
    }
    if (!rareMode && displayedVolume>0 && data.worldTotals[mode]) {
      const share=displayedVolume/data.worldTotals[mode];
      const rank=countries.filter(item=>value(item)>displayedVolume).length+1;
      children.push(n("p",{class:"mo-world-rank",text:`№${rank} серед країн у таблиці USDA · ${names[mode].toLowerCase()}`}));
      children.push(n("label",{for:"mo-world-share",class:"mo-world-small",text:pct(share)+" світового виробництва · "+names[mode].toLowerCase()}));
      children.push(n("progress",{id:"mo-world-share",class:"mo-world-share",max:"1",value:String(share),"aria-label":"Частка світового виробництва"}));
    }
    if (c.total == null && !rareMode)
      children.push(
        n("p", {
          class: "mo-world-small",
          text: "У вибраній таблиці USDA немає окремого обсягу для цієї країни. Це не означає відсутність вирощування.",
        }),
      );
    if (["liberica", "excelsa"].includes(mode))
      children.push(
        n("p", {
          class: "mo-world-small",
          text: "Світова таблиця не дає зіставного окремого обсягу для цього виду.",
        }),
      );
    const refKey = c.species[mode]?.source;
    const ref = refKey && data.sources[refKey];
    if (ref)
      children.push(
        n("a", {
          class: "mo-world-reference",
          href: ref.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: refKey === "usda" ? "USDA FAS · July 2026 · сезон 2025/26" : ref.name,
        }),
      );
    card.replaceChildren(...children);
    const number=card.querySelector(".mo-world-total");
    if(number && matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      const start=performance.now(), end=displayedVolume;
      const tick=now=>{if(!number.isConnected)return;const t=Math.min(1,(now-start)/450);number.textContent=volume(end*(1-Math.pow(1-t,3)));if(t<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
    }
    $("show-country").hidden = false;
    $("show-country").textContent = `Про країну: ${c.country}`;
  }
  function renderLegend() {
    legend.replaceChildren();
    const add = (className, text) =>
      legend.append(
        n(
          "span",
          { class: "mo-world-key" },
          n("i", { class: className, "aria-hidden": "true" }),
          n("span", { text }),
        ),
      );
    if (mode === "compare") {
      add("mo-world-swatch mo-world-arabica", "Арабіка");
      add("mo-world-swatch mo-world-robusta", "Робуста");
      add("mo-world-swatch mo-world-both", "Обидві");
    } else if (["liberica", "excelsa"].includes(mode)) {
      add("mo-world-swatch mo-world-presence", "Підтверджене вирощування");
    } else {
      legend.append(n("span",{class:"mo-world-legend-title",text:"Виробництво · млн мішків по 60 кг"}),n("div",{class:"mo-world-gradient","aria-hidden":"true"}),n("div",{class:"mo-world-gradient-labels"},...['0','0,5','2','5','15+'].map(text=>n("span",{text}))));
      add("mo-world-swatch mo-world-presence", "Обсяг не подано");
    }
  }

  function render() {
    hideTip();
    if (!loaded) return;
    const current = currentCountries();
    if (!byIso.has(selected) || !active(byIso.get(selected))) selected = "";
    root.dataset.species = mode;
    for (const button of root.querySelectorAll("[data-mo-species]")) {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.moSpecies === mode));
    }
    select.replaceChildren(...current.map((c) => n("option", { value: c.iso, text: c.country })));
    select.value = selected;
    select.disabled = false;
    const info = profiles[mode];
    profile.replaceChildren(

      n("p", { text: info.text }),

    );
    $("period").textContent = ["liberica", "excelsa"].includes(mode)
      ? "Географія вирощування"
      : "2025/26 · оцінка USDA";
    for (const [iso, path] of paths) {
      const c = byIso.get(iso),
        enabled = c && active(c);
      path.removeAttribute("data-level");
      path.classList.toggle("mo-world-selected", selected === iso);
      path.setAttribute("aria-pressed", String(enabled && selected === iso));
      path.classList.toggle("mo-world-presence", false);
      path.classList.toggle("mo-world-active", Boolean(enabled));
      path.style.removeProperty("fill");
      if (enabled) {
        path.setAttribute("role", "button");
        path.setAttribute("tabindex", iso === (selected || current[0]?.iso) ? "0" : "-1");
        path.setAttribute(
          "aria-label",
          `${c.country}${value(c) != null ? ": " + volume(value(c)) : ""}. Показати країну`,
        );
        if (mode === "compare")
          path.style.fill =
            has(c, "arabica") && has(c, "robusta")
              ? "url(#mo-world-both)"
              : has(c, "arabica")
                ? "var(--color-accent)"
                : "var(--color-primary)";
        else if (value(c) > 0) {
          const v = value(c);
          path.setAttribute(
            "data-level",
            String(v <= 500 ? 1 : v <= 2000 ? 2 : v <= 5000 ? 3 : v <= 15000 ? 4 : 5),
          );
        } else path.classList.add("mo-world-presence");
      } else {
        path.removeAttribute("tabindex");
        path.removeAttribute("role");
        path.removeAttribute("aria-label");
        path.removeAttribute("aria-pressed");
      }
    }
    renderLegend();
    renderCountry();
    if (!selected) showPlaceholder();
    root.classList.toggle("mo-world-awaiting", !selected);
    card.hidden = false;
    profile.hidden = false;
    const text = `${names[mode]}: ${current.length} країн у добірці. ${selected ? "Обрано: " + byIso.get(selected)?.country : "Натисни на країну"}.`;
    if (status.textContent !== text) status.textContent = text;
  }
  let opener;
  function openCountry() {
    card.hidden = false;
    profile.hidden = false;
    if (mobile.matches && !sheet.open) {
      opener=root.contains(document.activeElement)?document.activeElement:$("plus");
      sheetContent.append(card);sheet.showModal();document.body.classList.add("mo-world-sheet-open");$("close").focus();
    }
  }
  function choose(iso, open = true) {
    if (!byIso.has(iso) || !active(byIso.get(iso))) return;
    selected = iso;
    render();
    writeURL();
    renderCountry();
    if (open) openCountry();
  }
  for (const button of root.querySelectorAll("[data-mo-species]"))
    button.addEventListener("click", () => {
      mode = button.dataset.moSpecies;
      selected = "";
      const url=new URL(location.href);url.searchParams.delete("country");history.replaceState(null,"",url);
      zoom=1;center=[500,200];view();
      render();
      writeURL();
      showPlaceholder();profile.hidden=false;
    });
  select.addEventListener("change", () => choose(select.value));
  $("show-country").addEventListener("click", openCountry);
  $("close").addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => {
    home.append(card);
    document.body.classList.remove("mo-world-sheet-open");
    opener?.focus({ preventScroll: true });
  });
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) {
      const r = sheet.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        sheet.close();
    }
  });
  mobile.addEventListener("change", () => {
    if (sheet.open) sheet.close();
  });
  addEventListener("popstate", () => {
    if (!loaded) return;
    readURL();
    render();
  });
  function view() {
    const w = 1000 / zoom,
      h = 400 / zoom;
    center[0] = Math.max(w / 2, Math.min(1000 - w / 2, center[0]));
    center[1] = Math.max(h / 2, Math.min(400 - h / 2, center[1]));
    svg.setAttribute("viewBox", `${center[0] - w / 2} ${center[1] - h / 2} ${w} ${h}`);
    stage.classList.toggle("mo-world-zoomed", zoom > 1);
    $("minus").disabled = zoom <= 1;
    $("plus").disabled = zoom >= 4;
    $("reset").disabled = zoom === 1;
    $("reset").hidden = zoom === 1;
  }
  $("plus").addEventListener("click", () => {
    if (!loaded) return;
    if (zoom === 1 && byIso.has(selected)) center = point(byIso.get(selected).point);
    zoom = Math.min(4, zoom + 1);
    view();
  });
  $("minus").addEventListener("click", () => {
    zoom = Math.max(1, zoom - 1);
    view();
  });
  $("reset").addEventListener("click", () => {
    zoom = 1;
    center = [500, 200];
    view();
  });
  const tip = n("div", {class:"mo-world-tooltip", role:"tooltip", id:"mo-world-tooltip", hidden:""});
  let hovered;
  function hideTip() {
    tip.hidden = true;
    hovered?.classList.remove("mo-world-hovered");
    hovered?.removeAttribute("aria-describedby");
    hovered = null;
  }
  function showTip(path, x, y) {
    if (!path?.classList.contains("mo-world-active") || pointer?.moved) {hideTip();return;}
    if (hovered !== path) {hideTip();hovered=path;path.classList.add("mo-world-hovered");path.setAttribute("aria-describedby",tip.id);}
    const country=byIso.get(path.dataset.iso);
    tip.textContent=country.country + (value(country) != null ? " · " + volume(value(country)) : " · вирощування підтверджене");
    tip.hidden=false;
    const rect=stage.getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(x-rect.left+14,rect.width-tip.offsetWidth-8))+"px";
    tip.style.top=Math.max(8,Math.min(y-rect.top-42,rect.height-tip.offsetHeight-8))+"px";
  }
  stage.addEventListener("pointermove", e => {if(e.pointerType!=="touch")showTip(e.target.closest("path[data-iso]"),e.clientX,e.clientY);});
  stage.addEventListener("pointerleave",hideTip);
  stage.addEventListener("pointerdown",hideTip);
  stage.addEventListener("focusin", e => {const path=e.target.closest("path[data-iso]");if(path){const r=path.getBoundingClientRect();showTip(path,r.x+r.width/2,r.y);}});
  stage.addEventListener("focusout",hideTip);
  stage.addEventListener("keydown", e => {if(e.key==="Escape")hideTip();});
  async function load() {
    if (loaded || busy) return;
    busy = true;
    let loading = $("loading");
    if (!loading) {
      loading = n("p", { id: "mo-world-loading", role: "status" });
      stage.replaceChildren(loading);
    }
    loading.textContent = "Завантажуємо карту…";
    $("retry").hidden = true;
    try {
      const responses = await Promise.all([
        fetch(assetURL("assets/data/world-production.json")),
        fetch(assetURL("assets/maps/coffee-world.svg")),
      ]);
      if (responses.some((r) => !r.ok)) throw new Error("Map files unavailable");
      data = await responses[0].json();
      const doc = new DOMParser().parseFromString(await responses[1].text(), "image/svg+xml");
      if (!Array.isArray(data.countries) || doc.querySelector("parsererror"))
        throw new Error("Invalid map");
      countries = data.countries;
      byIso = new Map(countries.map((c) => [c.iso, c]));
      svg = document.importNode(doc.documentElement, true);
      paths = new Map([...svg.querySelectorAll("path[data-iso]")].map((p) => [p.dataset.iso, p]));
      const ns="http://www.w3.org/2000/svg";
      const pattern=document.createElementNS(ns,"pattern");pattern.id="mo-world-unknown";pattern.setAttribute("width","5");pattern.setAttribute("height","5");pattern.setAttribute("patternUnits","userSpaceOnUse");
      const bg=document.createElementNS(ns,"rect");bg.setAttribute("width","5");bg.setAttribute("height","5");bg.style.fill="var(--color-border)";
      const line=document.createElementNS(ns,"path");line.setAttribute("d","M-1 1L1 -1M0 5L5 0M4 6L6 4");line.style.stroke="var(--color-accent-strong)";line.setAttribute("stroke-width","1");pattern.append(bg,line);svg.querySelector("defs").append(pattern);
      stage.replaceChildren(svg, tip);
      stage.append(root.querySelector(".mo-world-zoom"));
      loaded = true;
      readURL();
      render();
      view();
      svg.addEventListener("click", (e) => {
        if (ignoreClick) return;
        const p = e.target.closest("[data-iso]");
        if (p) choose(p.dataset.iso);
      });
      svg.addEventListener("keydown", (e) => {
        const path = e.target.closest("path[data-iso]");
        if (!path) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose(path.dataset.iso);
          if (!mobile.matches) $("country-title").focus({ preventScroll: true });
        } else if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const list = currentCountries()
              .map((c) => paths.get(c.iso))
              .filter(Boolean),
            index = list.indexOf(path),
            next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? list.length - 1
                  : (index + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length;
          path.tabIndex = -1;
          list[next].setAttribute("tabindex", "0");
          list[next].focus();
        }
      });
      stage.addEventListener("pointerdown", (e) => {
        if (zoom <= 1 || e.button !== 0) return;
        pointer = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          center: [...center],
          moved: false,
        };
      });
      stage.addEventListener("pointermove", (e) => {
        if (!pointer || pointer.id !== e.pointerId) return;
        const dx = e.clientX - pointer.x,
          dy = e.clientY - pointer.y;
        if (!pointer.moved && Math.hypot(dx, dy) < 6) return;
        pointer.moved = true;
        stage.setPointerCapture(e.pointerId);
        const r = stage.getBoundingClientRect();
        center = [
          pointer.center[0] - (dx * (1000 / zoom)) / r.width,
          pointer.center[1] - (dy * (400 / zoom)) / r.height,
        ];
        view();
        e.preventDefault();
      });
      const end = () => {
        if (!pointer) return;
        ignoreClick = pointer.moved;
        const id = pointer.id;
        pointer = null;
        if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
        setTimeout(() => (ignoreClick = false), 100);
      };
      stage.addEventListener("pointerup", end);
      stage.addEventListener("pointercancel", end);
    } catch {
      loaded = false;
      stage.replaceChildren(
        n("p", { text: "Карта тимчасово недоступна. Спробуй завантажити її ще раз." }),
      );
      $("retry").hidden = false;
    } finally {
      busy = false;
    }
  }
  $("retry").addEventListener("click", load);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "350px" },
    );
    observer.observe(root);
  } else load();
})();
