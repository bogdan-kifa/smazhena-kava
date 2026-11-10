/* Static production-build server for local audits and CI, without the shop API. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const directory = path.resolve(process.argv[2] || "public");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".webp": "image/webp", ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = path.resolve(directory, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
  if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    const extension = path.extname(file);
    const compress = /\.(html|js|css|json|svg|xml|txt)$/.test(extension) &&
      /\bgzip\b/.test(request.headers["accept-encoding"] || "");
    response.setHeader("Content-Type", types[extension] || "application/octet-stream");
    response.setHeader("Vary", "Accept-Encoding");
    if (compress) { response.setHeader("Content-Encoding", "gzip"); content = zlib.gzipSync(content); }
    response.end(content);
  });
}).listen(Number(process.env.PORT || 5514), "127.0.0.1", () => console.log("Static audit server ready"));
