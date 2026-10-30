const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { database } = require("./db.cjs");
const { recipe, priceCart } = require("./pricing.cjs");
const derive = promisify(scrypt),
  TTL = 7 * 24 * 3600 * 1000,
  hash = (v) => createHash("sha256").update(v).digest("hex");
const fail = (status, message, code = "invalid_request") => {
  const e = new Error(message);
  Object.assign(e, { status, code });
  throw e;
};
const text = (v, min, max) =>
  typeof v === "string" && Array.from(v.trim()).length >= min && Array.from(v.trim()).length <= max;
const email = (v) =>
  typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(v);
const phone = (v) => {
  if (typeof v !== "string" || !/^[+0-9\s()-]*$/.test(v)) return "";
  let n = v.replace(/[\s()-]/g, "");
  if (/^0\d{9}$/.test(n)) n = "+38" + n;
  return /^\+380\d{9}$/.test(n) && n.length === 13 ? n : "";
};
const cookie = (req, name) => {
  try {
    return decodeURIComponent(
      (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith(name + "="))
        ?.slice(name.length + 1) || "",
    );
  } catch {
    return "";
  }
};
function setCookie(res, name, value, maxAge, secure) {
  const c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", [...(res.getHeader("Set-Cookie") || []), c]);
}
const userDTO = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  address: u.address,
  createdAt: new Date(Number(u.created)).toISOString(),
});
const orderDTO = (o) => ({
  id: o.id,
  status: o.status,
  total: Number(o.total),
  delivery: o.delivery,
  customer: JSON.parse(o.customer_json),
  items: JSON.parse(o.items_json),
  createdAt: new Date(Number(o.created)).toISOString(),
  payment: "receipt",
});
const mixDTO = (m) => ({
  ...JSON.parse(m.recipe_json),
  id: m.id,
  name: m.name,
  createdAt: new Date(Number(m.created)).toISOString(),
  updatedAt: new Date(Number(m.updated)).toISOString(),
});
async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const result = await derive(password, salt, 64, {
    N: 65536,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$${salt}$${result.toString("hex")}`;
}
async function passwordMatches(password, encoded) {
  const [method, salt, hex] = (encoded || "").split("$");
  if (method !== "scrypt" || !salt || !hex) return false;
  const actual = await derive(password, salt, 64, {
    N: 65536,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  const expected = Buffer.from(hex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
    fail(415, "Потрібен JSON-запит.");
  if (Number(req.headers["content-length"]) > 65536) fail(413, "Запит завеликий.");
  let b = req.body;
  if (b === undefined) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) fail(413, "Запит завеликий.");
      chunks.push(chunk);
    }
    b = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") {
    if (Buffer.byteLength(b) > 65536) fail(413, "Запит завеликий.");
    try {
      b = JSON.parse(b);
    } catch {
      fail(400, "Некоректний JSON.");
    }
  }
  if (typeof b === "object" && Buffer.byteLength(JSON.stringify(b)) > 65536)
    fail(413, "Запит завеликий.");
  if (!b || typeof b !== "object" || Array.isArray(b)) fail(400, "Некоректні дані.");
  return b;
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status, value) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  try {
    const url = new URL(req.url, "http://localhost"),
      route =
        "/" +
        (url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, "")).replace(
          /^\/+|\/+$/g,
          "",
        );
    const production = Boolean(process.env.VERCEL || process.env.NODE_ENV === "production"),
      secure = production || process.env.APP_ORIGIN?.startsWith("https:");
    const method = req.method;
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) fail(405, "Метод не підтримується.");
    if (method !== "GET") {
      const expected = process.env.APP_ORIGIN || (production ? "" : `http://${req.headers.host}`);
      if (!expected || req.headers.origin !== expected || req.headers["x-sk-request"] !== "1")
        fail(403, "Запит має надходити з цього сайту.", "origin");
    }
    const db = await database(),
      q = db.query;
    const token = cookie(req, "sk_session");
    const user =
      token && token.length <= 100
        ? (
            await q(
              "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?",
              [hash(token), Date.now()],
            )
          )[0]
        : null;
    const requireUser = () => {
      if (!user) fail(401, "Увійдіть у свій акаунт.", "unauthorized");
      return user;
    };
    const ip = process.env.VERCEL
      ? (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
      : req.socket?.remoteAddress || "local";
    async function limit(kind, max, windowMs) {
      const now = Date.now(),
        bucket = hash(`${kind}:${ip}`);
      const r = (
        await q(
          "INSERT INTO rate_limits(bucket,hits,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN rate_limits.expires<? THEN 1 ELSE rate_limits.hits+1 END,expires=CASE WHEN rate_limits.expires<? THEN ? ELSE rate_limits.expires END RETURNING hits",
          [bucket, now + windowMs, now, now, now + windowMs],
        )
      )[0];
      if (Number(r.hits) > max) {
        res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
        fail(429, "Забагато спроб. Спробуйте пізніше.", "rate_limit");
      }
    }
    async function startSession(id) {
      const value = randomBytes(32).toString("base64url");
      await q("DELETE FROM sessions WHERE expires<?", [Date.now()]);
      await q("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)", [
        hash(value),
        id,
        Date.now() + TTL,
      ]);
      setCookie(res, "sk_session", value, TTL / 1000, secure);
    }
    if (route === "/health" && method === "GET") return send(200, { ok: true });
    if (route === "/auth/me" && method === "GET") {
      const mixCount = user
        ? Number(
            (await q("SELECT COUNT(*) AS count FROM mixes WHERE user_id=?", [user.id]))[0].count,
          )
        : 0;
      return send(200, { user: user ? { ...userDTO(user), mixCount } : null });
    }
    if (route === "/auth/register" && method === "POST") {
      await limit("register", 5, 3600000);
      const b = await body(req);
      if (
        !text(b.name, 2, 80) ||
        !email(b.email) ||
        !text(b.password, 8, 128) ||
        !/\p{L}/u.test(b.password) ||
        !/\d/.test(b.password) ||
        b.consent !== true
      )
        fail(422, "Перевірте ім’я, email, пароль і згоду.");
      const id = randomUUID(),
        normalized = b.email.trim().toLowerCase(),
        encoded = await passwordHash(b.password);
      try {
        await q(
          "INSERT INTO users(id,email,name,phone,address,password_hash,created) VALUES(?,?,?,?,?,?,?)",
          [id, normalized, b.name.trim(), "", "", encoded, Date.now()],
        );
      } catch (e) {
        if (e.code === "23505" || /UNIQUE constraint/.test(e.message))
          fail(409, "Акаунт із такою адресою вже існує.", "email_exists");
        throw e;
      }
      await startSession(id);
      return send(201, { user: userDTO((await q("SELECT * FROM users WHERE id=?", [id]))[0]) });
    }
    if (route === "/auth/login" && method === "POST") {
      await limit("login", 12, 900000);
      const b = await body(req);
      if (!email(b.email) || !text(b.password, 1, 128))
        fail(401, "Неправильний email або пароль.", "credentials");
      const found = (
        await q("SELECT * FROM users WHERE email=?", [b.email.trim().toLowerCase()])
      )[0];
      const encoded =
        found?.password_hash || "scrypt$00000000000000000000000000000000$" + "00".repeat(64);
      const correct = await passwordMatches(b.password, encoded);
      if (!found || !correct) fail(401, "Неправильний email або пароль.", "credentials");
      if (token) await q("DELETE FROM sessions WHERE token_hash=?", [hash(token)]);
      await startSession(found.id);
      return send(200, { user: userDTO(found) });
    }
    if (route === "/auth/logout" && method === "POST") {
      if (token) await q("DELETE FROM sessions WHERE token_hash=?", [hash(token)]);
      setCookie(res, "sk_session", "", 0, secure);
      return send(200, { ok: true });
    }
    if (route === "/profile" && method === "PATCH") {
      requireUser();
      await limit("profile", 30, 3600000);
      const b = await body(req);
      if (
        !text(b.name, 2, 80) ||
        typeof b.phone !== "string" ||
        (b.phone && !phone(b.phone)) ||
        !text(b.address || "", 0, 300)
      )
        fail(422, "Перевірте ім’я, телефон і адресу.");
      await q("UPDATE users SET name=?,phone=?,address=? WHERE id=?", [
        b.name.trim(),
        b.phone ? phone(b.phone) : "",
        (b.address || "").trim(),
        user.id,
      ]);
      return send(200, {
        user: userDTO((await q("SELECT * FROM users WHERE id=?", [user.id]))[0]),
      });
    }
    if (route === "/auth/password" && method === "POST") {
      requireUser();
      await limit("password", 6, 3600000);
      const b = await body(req);
      if (
        !text(b.currentPassword, 1, 128) ||
        !text(b.password, 8, 128) ||
        !/\p{L}/u.test(b.password) ||
        !/\d/.test(b.password)
      )
        fail(422, "Новий пароль: 8–128 символів, літера й цифра.");
      if (!(await passwordMatches(b.currentPassword, user.password_hash)))
        fail(401, "Поточний пароль неправильний.");
      await q("UPDATE users SET password_hash=? WHERE id=?", [
        await passwordHash(b.password),
        user.id,
      ]);
      await q("DELETE FROM sessions WHERE user_id=?", [user.id]);
      await startSession(user.id);
      return send(200, { ok: true });
    }
    if (route === "/orders" && method === "POST") {
      await limit("orders", 30, 900000);
      const b = await body(req),
        c = b.customer;
      if (
        !c ||
        !text(c.name, 2, 80) ||
        !email(c.email) ||
        !phone(c.phone) ||
        !text(c.address, 5, 300) ||
        !["post", "nova-poshta", "ukrposhta", "courier"].includes(b.delivery)
      )
        fail(422, "Перевірте контакти та адресу доставки.");
      if (b.delivery === "ukrposhta" && !/(?:^|\D)\d{5}(?!\d)/.test(c.address))
        fail(422, "Укажіть п’ятизначний індекс Укрпошти.");
      const priced = priceCart(b.items);
      if (b.expectedTotal !== priced.total)
        fail(409, "Ціна кошика змінилася. Перевірте підсумок.", "price_changed");
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[\w-]{16,80}$/.test(key))
        fail(422, "Потрібен унікальний ключ замовлення.");
      const requestKey = hash(`${user ? "user:" + user.id : "guest"}:${key}`),
        requestHash = hash(
          JSON.stringify({ items: priced.items, customer: c, delivery: b.delivery }),
        );
      const previous = (await q("SELECT * FROM orders WHERE request_key=?", [requestKey]))[0];
      if (previous) {
        if (previous.request_hash !== requestHash)
          fail(409, "Кошик змінився. Повторіть оформлення.", "idempotency_conflict");
        if (!user && (Number(previous.created) <= Date.now() - 86400000 || hash(cookie(req, "sk_receipt")) !== previous.receipt_hash))
          fail(409, "Це замовлення вже створено. Перевірте попереднє підтвердження.");
        return send(200, { order: orderDTO(previous) });
      }
      const id = randomUUID(),
        receipt = /^[A-Za-z0-9_-]{43}$/.test(cookie(req, "sk_receipt")) ? cookie(req, "sk_receipt") : randomBytes(32).toString("base64url"),
        created = Date.now();
      try {
        await q(
          "INSERT INTO orders(id,user_id,receipt_hash,request_key,request_hash,status,total,delivery,customer_json,items_json,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          [
            id,
            user?.id || null,
            user ? null : hash(receipt),
            requestKey,
            requestHash,
            "new",
            priced.total,
            b.delivery,
            JSON.stringify({
              name: c.name.trim(),
              email: c.email.trim().toLowerCase(),
              phone: phone(c.phone),
              address: c.address.trim(),
            }),
            JSON.stringify(priced.items),
            created,
          ],
        );
      } catch (e) {
        if (e.code === "23505" || /UNIQUE constraint/.test(e.message))
          fail(409, "Замовлення вже обробляється. Повторіть спробу з тим самим кошиком.");
        throw e;
      }
      if (!user) setCookie(res, "sk_receipt", receipt, 86400, secure);
      return send(201, { order: orderDTO((await q("SELECT * FROM orders WHERE id=?", [id]))[0]) });
    }
    if (route === "/orders" && method === "GET") {
      requireUser();
      const pageSize = 20;
      let cursor = null;
      if (url.searchParams.has("cursor")) {
        try { cursor = JSON.parse(Buffer.from(url.searchParams.get("cursor"), "base64url").toString()); } catch {}
        if (!cursor || !Number.isSafeInteger(cursor.created) || typeof cursor.id !== "string" || !/^[\w-]{1,80}$/.test(cursor.id)) fail(422, "Некоректна сторінка історії.");
      }
      const rows = await q("SELECT * FROM orders WHERE user_id=?" + (cursor ? " AND (created<? OR (created=? AND id<?))" : "") + " ORDER BY created DESC,id DESC LIMIT ?", cursor ? [user.id,cursor.created,cursor.created,cursor.id,pageSize+1] : [user.id,pageSize+1]);
      const visible = rows.slice(0,pageSize), last = visible.at(-1);
      const total = Number((await q("SELECT COUNT(*) AS count FROM orders WHERE user_id=?",[user.id]))[0].count);
      return send(200, { orders: visible.map(orderDTO), total, nextCursor: rows.length > pageSize ? Buffer.from(JSON.stringify({created:Number(last.created),id:last.id})).toString("base64url") : null });
    }
    if (/^\/orders\/[\w-]+$/.test(route) && method === "GET") {
      const o = (await q("SELECT * FROM orders WHERE id=?", [route.split("/")[2]]))[0];
      if (
        !o ||
        !(
          (user && o.user_id === user.id) ||
          (!o.user_id && Number(o.created) > Date.now() - 86400000 && o.receipt_hash === hash(cookie(req, "sk_receipt")))
        )
      )
        fail(404, "Замовлення не знайдено.");
      return send(200, { order: orderDTO(o) });
    }
    if (route === "/mixes" && method === "GET") {
      requireUser();
      const rows = await q(
        "SELECT * FROM mixes WHERE user_id=? ORDER BY updated DESC, id LIMIT 100",
        [user.id],
      );
      return send(200, {
        mixes: rows.map(mixDTO),
      });
    }
    if (route === "/mixes" && method === "POST") {
      requireUser();
      await limit("mixes", 60, 3600000);
      const b = await body(req);
      if (!text(b.name, 1, 60)) fail(422, "Введіть назву міксу до 60 символів.");
      const m = recipe({ ...b.recipe, name: b.name });
      const count = Number(
        (await q("SELECT COUNT(*) AS count FROM mixes WHERE user_id=?", [user.id]))[0].count,
      );
      if (count >= 100) fail(422, "Можна зберегти до 100 міксів.");
      const id = randomUUID(),
        now = Date.now();
      await q(
        "INSERT INTO mixes(id,user_id,name,recipe_json,created,updated) VALUES(?,?,?,?,?,?)",
        [id, user.id, m.name, JSON.stringify(m), now, now],
      );
      return send(201, {
        mix: {
          ...m,
          id,
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
      });
    }
    if (/^\/mixes\/[\w-]+$/.test(route) && method === "PATCH") {
      requireUser();
      await limit("mix-update", 120, 3600000);
      const b = await body(req);
      if (Object.keys(b).some((key) => !["name", "recipe"].includes(key)))
        fail(422, "Передайте назву та, за потреби, склад міксу.");
      const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
      if (!name || name.length > 60) fail(422, "Введіть назву міксу від 1 до 60 символів.");
      const updatedRecipe = b.recipe === undefined ? null : recipe({ ...b.recipe, name });
      const row = (
        await q("UPDATE mixes SET name=?,recipe_json=COALESCE(?,recipe_json),updated=? WHERE id=? AND user_id=? RETURNING *", [
          name,
          updatedRecipe ? JSON.stringify(updatedRecipe) : null,
          Date.now(),
          route.split("/")[2],
          user.id,
        ])
      )[0];
      if (!row) fail(404, "Мікс не знайдено.");
      return send(200, { mix: mixDTO(row) });
    }
    if (/^\/mixes\/[\w-]+$/.test(route) && method === "DELETE") {
      requireUser();
      await q("DELETE FROM mixes WHERE id=? AND user_id=?", [route.split("/")[2], user.id]);
      return send(200, { ok: true });
    }
    fail(404, "Адресу API не знайдено.");
  } catch (e) {
    if (!e.status) console.error("API failure:", e.code || e.name);
    send(e.status || 503, {
      error: e.status ? e.message : "Сервіс тимчасово недоступний. Спробуйте пізніше.",
      code: e.code || "unavailable",
    });
  }
}
module.exports = handler;
