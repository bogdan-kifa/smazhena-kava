const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function bundleStyles(directory) {
  const pages = [
    ...fs.readdirSync(directory).filter(file => file.endsWith(".html")),
    ...fs.readdirSync(path.join(directory, "products"))
      .filter(file => file.endsWith(".html")).map(file => "products/" + file),
  ];
  for (const page of pages) {
    const filename = path.join(directory, page);
    let html = fs.readFileSync(filename, "utf8");
    const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)]
      .map(match => ({ tag: match[0], href: match[0].match(/\bhref="([^"]+)"/)?.[1] }))
      .filter(link => /^(?:\.\.\/)?css\/[^/]+\.css$/.test(link.href || "") && !/\bmedia=/.test(link.tag));
    if (links.length < 2) continue;
    const css = links.map(link => fs.readFileSync(path.resolve(path.dirname(filename), link.href), "utf8")).join("\n");
    const hash = crypto.createHash("sha256").update(css).digest("hex").slice(0, 12);
    const name = "bundle-" + hash + ".css";
    fs.writeFileSync(path.join(directory, "css", name), css);
    const prefix = page.startsWith("products/") ? "../" : "";
    links.forEach((link, index) => {
      html = html.replace(link.tag, index === 0
        ? '<link rel="stylesheet" href="' + prefix + "css/" + name + '" />' : "");
    });
    fs.writeFileSync(filename, html);
  }
}

module.exports = { bundleStyles };
