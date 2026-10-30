const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const handler = require("./api.cjs");
const ROOT = path.resolve(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
function notFound(req, res) {
  const html = fs.readFileSync(path.join(ROOT, "404.html"));
  res.writeHead(404, {"Content-Type":"text/html; charset=utf-8", "Content-Length":html.length,"X-Content-Type-Options":"nosniff"});
  res.end(req.method === "HEAD" ? undefined : html);
}
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const host = (req.headers.host || "").toLowerCase();
      const allowed = process.env.APP_ORIGIN
        ? new URL(process.env.APP_ORIGIN).host.toLowerCase()
        : null;
      if (host !== allowed && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
        res.writeHead(403);
        return res.end("Untrusted host");
      }
      if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
        return await handler(req, res);
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      let rel = decodeURIComponent(url.pathname).replace(/^\//, "");
      if (!rel) rel = "index.html";
      if (
        rel.includes("\\") ||
        rel.split("/").some((s) => s.startsWith(".")) ||
        !/^(?:[\w-]+\.html|products\/[\w-]+\.html|(?:css|js|assets)\/[\w./-]+)$/.test(rel)
      ) {
        if (/^[\w-]+$/.test(rel) && fs.existsSync(path.join(ROOT, rel + ".html"))) {
          res.writeHead(302, { Location: "/" + rel + ".html" + url.search });
          return res.end();
        }
        return notFound(req, res);
      }
      const filename = path.resolve(ROOT, rel);
      if (!filename.startsWith(ROOT + path.sep)) {
        res.writeHead(404);
        return res.end();
      }
      const stat = await fs.promises.stat(filename).catch(() => null);
      if (!stat?.isFile()) {
        return notFound(req, res);
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filename)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-cache",
        "Content-Length": stat.size,
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filename).pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(400);
      res.end("Bad request");
    }
  });
}
if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1",
    port = Number(process.env.PORT || 3000);
  createServer().listen(port, host, () => console.log(`Смажена Кава: http://${host}:${port}`));
}
module.exports = { createServer };
