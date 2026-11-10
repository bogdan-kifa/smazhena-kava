const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const files = [
  ...fs.readdirSync(output).filter((file) => file.endsWith(".html")),
  ...fs.readdirSync(path.join(output, "products"))
    .filter((file) => file.endsWith(".html")).map((file) => "products/" + file),
];
const errors = [];
function check(condition, description) { if (!condition) errors.push(description); }
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map((match) => [match[1].toLowerCase(), match[2]]));
}
for (const file of files) {
  const html = fs.readFileSync(path.join(output, file), "utf8");
  check((html.match(/<h1\b/g) || []).length === 1, file + " must have one h1");
  check(/<html[^>]+lang="uk"/.test(html), file + " must declare Ukrainian");
  const ids = new Set();
  for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) {
    const attrs = attributes(tag);
    if (attrs.id) { check(!ids.has(attrs.id), file + " duplicate id " + attrs.id); ids.add(attrs.id); }
    if (/^<img\b/.test(tag)) check("alt" in attrs, file + " image without alt");
    if (attrs.target === "_blank") check(/\bnoopener\b/.test(attrs.rel || ""),
      file + " external tab without noopener");
    for (const attribute of ["src", "href", "poster"]) {
      const value = attrs[attribute];
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;
      const clean = decodeURIComponent(value.split(/[?#]/)[0]);
      const target = clean.startsWith("/")
        ? path.resolve(output, "." + clean)
        : path.resolve(path.dirname(path.join(output, file)), clean || ".");
      check(target.startsWith(output + path.sep) && fs.existsSync(target), file + " missing " + value);
    }
  }
  for (const [tag] of html.matchAll(/<[^>]+\baria-(?:labelledby|describedby)="[^"]*"[^>]*>/g)) {
    const attrs = attributes(tag);
    for (const key of ["aria-labelledby", "aria-describedby"]) {
      for (const id of (attrs[key] || "").split(/\s+/).filter(Boolean)) {
        check(ids.has(id), file + " missing ARIA target " + id);
      }
    }
  }
  check(/rel="canonical"/.test(html), file + " missing canonical");
  check(/property="og:title"/.test(html), file + " missing Open Graph title");
}
for (const directory of ["js", "server", "tests"]) {
  for (const file of fs.readdirSync(path.join(root, directory)).filter((file) => /\.(js|cjs)$/.test(file))) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, directory, file)], { encoding: "utf8" });
    check(result.status === 0, directory + "/" + file + " syntax error " + result.stderr);
  }
}
check(fs.existsSync(path.join(output, "robots.txt")), "Missing robots.txt");
check(fs.existsSync(path.join(output, "sitemap.xml")), "Missing sitemap.xml");
assert.equal(errors.length, 0, errors.join("\n"));
console.log("Verified " + files.length + " pages, local resources, ARIA references and JavaScript syntax.");
