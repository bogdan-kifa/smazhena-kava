const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/products.js"), "utf8"), sandbox, {
  timeout: 1000,
});
const catalog = new Map(
  JSON.parse(JSON.stringify(sandbox.window.COFFEE_PRODUCTS)).map((p) => [p.id, p]),
);
const {grinds,roasts,packaging:packs,weights,productWeights,available} = require("../js/commerce-rules.js");
function reject(message) {
  const e = new Error(message);
  e.status = 422;
  throw e;
}
function integer(v, min, max) {
  return Number.isSafeInteger(v) && v >= min && v <= max;
}
function recipe(input) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.beans) ||
    input.beans.length < 1 ||
    input.beans.length > 4
  )
    reject("Оберіть від одного до чотирьох сортів.");
  if (
    !weights.includes(input.weight) ||
    !Object.hasOwn(grinds, input.grind) ||
    !Object.hasOwn(packs, String(input.packaging))
  )
    reject("Перевірте вагу, помел і пакування міксу.");
  const seen = new Set(),
    slots = new Set();
  const beans = input.beans.map((b, index) => {
    const p = catalog.get(b?.id);
    if (!p || seen.has(p.id) || !integer(b.ratio, 0, 100)) reject("Неправильний склад міксу.");
    seen.add(p.id);
    if (p.category === "green" && !Object.hasOwn(roasts, b.roast))
      reject("Оберіть обсмаження зеленого зерна.");
    const slot =
      integer(b.slot, 0, 3) && !slots.has(b.slot)
        ? b.slot
        : [0, 1, 2, 3].find((n) => !slots.has(n));
    slots.add(slot);
    return {
      id: p.id,
      ratio: b.ratio,
      slot,
      ...(p.category === "green" ? { roast: b.roast } : {}),
    };
  });
  if (beans.reduce((n, b) => n + b.ratio, 0) !== 100) reject("Сума часток має дорівнювати 100%.");
  const name = typeof input.name === "string" ? input.name.trim() : "Мій мікс";
  if (!name || name.length > 60) reject("Назва міксу має містити до 60 символів.");
  return {
    name,
    beans,
    weight: input.weight,
    grind: input.grind,
    packaging: String(input.packaging),
  };
}
function mixPrice(m) {
  return (
    Math.round(
      (m.beans.reduce((sum, b) => sum + (catalog.get(b.id).price * b.ratio) / 100, 0) * m.weight) /
        250,
    ) + packs[m.packaging].price
  );
}
function priceCart(cart) {
  if (!Array.isArray(cart) || cart.length < 1 || cart.length > 50)
    reject("Кошик має містити від 1 до 50 позицій.");
  const items = cart.map((item) => {
    if (!item || !integer(item.qty, 1, 99)) reject("Неправильна кількість товару.");
    if (item.type === "product") {
      const p = catalog.get(item.id);
      if (!available(p) || !productWeights.includes(item.weight) || !Object.hasOwn(grinds, item.grind))
        reject("Товар або його параметри недоступні.");
      let roast = p.roast;
      if (p.category === "green") {
        roast = item.roast || "raw";
        if (roast !== "raw" && !Object.hasOwn(roasts, roast)) reject("Неправильне обсмаження.");
        if (roast === "raw" && item.grind !== "beans")
          reject("Зелене зерно без обсмаження не мелемо.");
      }
      const unit = Math.round((p.price * item.weight) / 250);
      return {
        type: "product",
        id: p.id,
        name: p.name,
        weight: item.weight,
        grind: item.grind,
        roast,
        qty: item.qty,
        unit,
        total: unit * item.qty,
        image: p.image,
        details: `${roast === "raw" ? "Без обсмаження" : roasts[roast] + " обсмаження"} · ${grinds[item.grind]}`,
      };
    }
    if (item.type === "mix") {
      const mix = recipe(item.mix);
      if (mix.beans.some((b) => !available(catalog.get(b.id)))) reject("Один із сортів міксу тимчасово недоступний.");
      const unit = mixPrice(mix);
      return {
        type: "mix",
        name: mix.name,
        mix,
        weight: mix.weight,
        qty: item.qty,
        unit,
        total: unit * item.qty,
        image: "assets/images/coffee/brazil-cerrado-packaging.webp",
        details:
          mix.beans
            .filter((b) => b.ratio > 0)
            .map((b) => `${catalog.get(b.id).name} ${b.ratio}%${catalog.get(b.id).category === "green" ? ` (${roasts[b.roast]} обсмаження)` : ""}`)
            .join(" · ") + ` · ${grinds[mix.grind]} · ${packs[mix.packaging].name}`,
      };
    }
    reject("Невідомий тип товару.");
  });
  const total = items.reduce((n, i) => n + i.total, 0);
  if (!integer(total, 1, 100000000)) reject("Неприпустима сума замовлення.");
  return { items, total };
}
module.exports = { recipe, priceCart };
