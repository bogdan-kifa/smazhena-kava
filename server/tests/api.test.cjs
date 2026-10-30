const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { randomUUID } = require("node:crypto");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "coffee-api-test-"));
process.env.SQLITE_PATH = path.join(temp, "store.sqlite");
delete process.env.DATABASE_URL;
const { createServer } = require("../index.cjs");
const { database } = require("../db.cjs");
const server = createServer();
let base;
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await (await database()).close();
  fs.rmSync(temp, { recursive: true, force: true });
});
function client() {
  const jar = new Map();
  return {
    jar,
    async request(route, { method = "GET", body, headers = {}, raw } = {}) {
      const res = await fetch(base + route, {
        method,
        headers: {
          Origin: base,
          "X-SK-Request": "1",
          ...(body || raw ? { "Content-Type": "application/json" } : {}),
          Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
          ...headers,
        },
        body: raw ?? (body ? JSON.stringify(body) : undefined),
      });
      for (const value of res.headers.getSetCookie()) {
        const [name, token] = value.split(";")[0].split("=");
        jar.set(name, token);
      }
      return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) };
    },
  };
}
const credentials = {
  name: "Тестова людина",
  email: "alpha@example.test",
  password: "CoffeeStrong123",
  consent: true,
};
const cart = [{ type: "product", id: "colombia-huila", weight: 250, grind: "filter", qty: 1 }];
const orderBody = {
  items: cart,
  delivery: "ukrposhta",
  expectedTotal: 32000,
  customer: {
    name: "Тестова людина",
    email: credentials.email,
    phone: "+380501234567",
    address: "Львів, відділення 79000",
  },
};
const mix = {
  name: "Мій тест",
  beans: [{ id: "colombia-huila", ratio: 100, slot: 0 }],
  weight: 250,
  grind: "filter",
  packaging: "1",
};
test("Account, privacy, canonical prices, sessions and persistence", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const a = client(),
    b = client(),
    guest = client();
  let account, order, m;
  await t.test("CSRF, malformed JSON, size limit, private static files", async () => {
    assert.equal(
      (
        await a.request("/api/auth/register", {
          method: "POST",
          body: credentials,
          headers: { Origin: "https://foreign.test" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.request("/api/auth/register", {
          method: "POST",
          body: credentials,
          headers: { "X-SK-Request": "" },
        })
      ).status,
      403,
    );
    assert.equal((await a.request("/api/auth/login", { method: "POST", raw: "{" })).status, 400);
    assert.equal(
      (
        await a.request("/api/auth/login", {
          method: "POST",
          raw: JSON.stringify({ v: "x".repeat(70000) }),
        })
      ).status,
      413,
    );
    for (const name of [
      "/.env",
      "/.data/store.sqlite",
      "/server/api.cjs",
      "/package.json",
      "/api/../.env",
    ])
      assert.equal((await fetch(base + name)).status, 404, name);
  });
  await t.test("Real signup, cookie flags, no password disclosure", async () => {
    const response = await a.request("/api/auth/register", { method: "POST", body: credentials });
    assert.equal(response.status, 201);
    account = response.data.user;
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
    assert.equal(response.data.user.email, credentials.email);
    assert.equal(response.data.user.password_hash, undefined);
    const stored = (
      await (await database()).query("SELECT password_hash FROM users WHERE id=?", [account.id])
    )[0].password_hash;
    assert.match(stored, /^scrypt\$/);
    assert.ok(!stored.includes(credentials.password));
    assert.equal((await a.request("/api/auth/me")).data.user.id, account.id);
    assert.equal((await b.request("/api/orders")).status, 401);
    assert.equal(
      (
        await b.request("/api/auth/login", {
          method: "POST",
          body: { ...credentials, password: "wrong" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await b.request("/api/auth/register", {
          method: "POST",
          body: { ...credentials, email: "beta@example.test" },
        })
      ).status,
      201,
    );
  });
  await t.test("Profile validation and ownership", async () => {
    assert.equal(
      (
        await a.request("/api/profile", {
          method: "PATCH",
          body: { name: "Оновлене ім’я", phone: "0501234567", address: "Київ, 1" },
        })
      ).status,
      200,
    );
    assert.equal((await a.request("/api/auth/me")).data.user.phone, "+380501234567");
    assert.equal((await b.request("/api/auth/me")).data.user.name, credentials.name);
    assert.equal(
      (
        await a.request("/api/profile", {
          method: "PATCH",
          body: { name: "A", phone: "bad", address: "" },
        })
      ).status,
      422,
    );
  });
  await t.test("Private saved mixes, invalid ratios and owner-only deletion", async () => {
    assert.equal(
      (
        await a.request("/api/mixes", {
          method: "POST",
          body: {
            name: mix.name,
            recipe: { ...mix, beans: [{ id: "colombia-huila", ratio: 90 }] },
          },
        })
      ).status,
      422,
    );
    const response = await a.request("/api/mixes", {
      method: "POST",
      body: { name: mix.name, recipe: mix },
    });
    assert.equal(response.status, 201);
    m = response.data.mix;
    assert.equal((await a.request("/api/mixes")).data.mixes.length, 1);
    assert.equal((await a.request("/api/auth/me")).data.user.mixCount, 1);
    assert.equal((await b.request("/api/mixes")).data.mixes.length, 0);
    assert.equal((await b.request("/api/auth/me")).data.user.mixCount, 0);
    await b.request("/api/mixes/" + m.id, { method: "DELETE", body: {} });
    assert.equal((await a.request("/api/mixes")).data.mixes.length, 1);
    assert.equal((await a.request("/api/auth/me")).data.user.mixCount, 1);
  });
  await t.test("Rename validates the name, isolates owners and persists", async () => {
    const route = "/api/mixes/" + m.id;
    assert.equal(
      (await client().request(route, { method: "PATCH", body: { name: "Чужа назва" } })).status,
      401,
    );
    assert.equal(
      (await b.request(route, { method: "PATCH", body: { name: "Чужа назва" } })).status,
      404,
    );
    for (const body of [
      {},
      { name: "   " },
      { name: "x".repeat(61) },
      { name: null },
      { name: "Нове", weight: 1000 },
    ])
      assert.equal((await a.request(route, { method: "PATCH", body })).status, 422);
    const response = await a.request(route, {
      method: "PATCH",
      body: { name: "  Кава   на ранок  " },
    });
    assert.equal(response.status, 200);
    assert.equal(response.data.mix.name, "Кава на ранок");
    assert.deepEqual(response.data.mix.beans, m.beans);
    assert.equal(response.data.mix.weight, m.weight);
    await new Promise((resolve) => server.close(resolve));
    await (await database()).close();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = "http://127.0.0.1:" + server.address().port;
    assert.equal((await a.request("/api/mixes")).data.mixes[0].name, "Кава на ранок");
    assert.equal((await b.request("/api/mixes")).data.mixes.length, 0);
    assert.equal((await b.request("/api/auth/me")).data.user.mixCount, 0);
  });
  await t.test("Server prices and idempotent orders; no cross-account access", async () => {
    assert.equal(
      (
        await a.request("/api/orders", {
          method: "POST",
          body: { ...orderBody, expectedTotal: 1 },
          headers: { "Idempotency-Key": randomUUID() },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await a.request("/api/orders", {
          method: "POST",
          body: { ...orderBody, items: [{ ...cart[0], id: "unknown" }] },
          headers: { "Idempotency-Key": randomUUID() },
        })
      ).status,
      422,
    );
    const key = randomUUID(),
      options = { method: "POST", body: orderBody, headers: { "Idempotency-Key": key } };
    const first = await a.request("/api/orders", options);
    assert.equal(first.status, 201);
    order = first.data.order;
    assert.equal(order.total, 32000);
    assert.equal((await a.request("/api/orders", options)).data.order.id, order.id);
    assert.equal(
      (
        await a.request("/api/orders", {
          ...options,
          body: { ...orderBody, customer: { ...orderBody.customer, name: "Інший" } },
        })
      ).status,
      409,
    );
    assert.equal((await a.request("/api/orders")).data.orders.length, 1);
    assert.equal((await b.request("/api/orders")).data.orders.length, 0);
    assert.equal((await b.request("/api/orders/" + order.id)).status, 404);
    assert.equal((await guest.request("/api/orders/" + order.id)).status, 404);
  });
  await t.test("Guest receipt requires private cookie; never auto-link by email", async () => {
    const options = {
      method: "POST",
      body: orderBody,
      headers: { "Idempotency-Key": randomUUID() },
    };
    const response = await guest.request("/api/orders", options);
    assert.equal(response.status, 201);
    const id = response.data.order.id;
    assert.equal((await guest.request("/api/orders/" + id)).status, 200);
    assert.equal((await client().request("/api/orders/" + id)).status, 404);
    assert.equal((await a.request("/api/orders/" + id)).status, 404);
    assert.equal((await a.request("/api/orders")).data.orders.length, 1);
    assert.equal((await guest.request("/api/orders", options)).data.order.id, id);
  });
  await t.test("Change password revokes all prior sessions; logout revokes cookie", async () => {
    const other = client();
    assert.equal(
      (await other.request("/api/auth/login", { method: "POST", body: credentials })).status,
      200,
    );
    assert.equal(
      (
        await a.request("/api/auth/password", {
          method: "POST",
          body: { currentPassword: credentials.password, password: "NewCoffee123" },
        })
      ).status,
      200,
    );
    assert.equal((await other.request("/api/auth/me")).data.user, null);
    assert.equal(
      (await other.request("/api/auth/login", { method: "POST", body: credentials })).status,
      401,
    );
    assert.equal(
      (
        await other.request("/api/auth/login", {
          method: "POST",
          body: { ...credentials, password: "NewCoffee123" },
        })
      ).status,
      200,
    );
    await other.request("/api/auth/logout", { method: "POST", body: {} });
    assert.equal((await other.request("/api/auth/me")).data.user, null);
    await a.request("/api/mixes/" + m.id, { method: "DELETE", body: {} });
    assert.equal((await a.request("/api/mixes")).data.mixes.length, 0);
    assert.equal((await a.request("/api/auth/me")).data.user.mixCount, 0);
  });
  await t.test("Orders survive server recreation", async () => {
    await new Promise((resolve) => server.close(resolve));
    await (await database()).close();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = "http://127.0.0.1:" + server.address().port;
    assert.equal((await a.request("/api/orders")).data.orders[0].id, order.id);
  });
  await t.test("Rate limit, untrusted Host and production persistence guard", async () => {
    const rejected = await new Promise((resolve, reject) => {
      require("node:http")
        .get(base + "/api/health", { headers: { Host: "foreign.test" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        })
        .on("error", reject);
    });
    assert.equal(rejected, 403);
    let response;
    for (let i = 0; i < 13; i++)
      response = await b.request("/api/auth/login", {
        method: "POST",
        body: { email: "bad", password: "bad" },
      });
    assert.equal(response.status, 429);
    assert.ok(response.headers.get("retry-after"));
    const { spawnSync } = require("node:child_process");
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "require('./server/db.cjs').database().then(()=>process.exit(2)).catch(e=>{console.log(e.message);process.exit(0);})",
      ],
      {
        cwd: path.resolve(__dirname, "../.."),
        env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "" },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0);
    assert.match(result.stdout, /DATABASE_URL is required/);
  });
});
