const fs = require("node:fs");
const path = require("node:path");

const publicPages = [
  "index.html", "catalog.html", "constructor.html", "quiz.html",
  "about.html", "contacts.html", "delivery.html", "faq.html", "privacy.html",
];
const escapeAttribute = (value) => value.replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;").replaceAll("<", "&lt;");

function generateMetadata(directory) {
  const configured = process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : "https://smazhena-kava-lab12.vercel.app");
  const base = new URL(configured);
  if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid SITE_URL");
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  const pages = [
    ...fs.readdirSync(directory).filter((name) => name.endsWith(".html")),
    ...fs.readdirSync(path.join(directory, "products"))
      .filter((name) => name.endsWith(".html")).map((name) => "products/" + name),
  ];
  const links = [];
  for (const page of pages) {
    const filename = path.join(directory, page);
    let html = fs.readFileSync(filename, "utf8");
    const indexable = publicPages.includes(page) || page.startsWith("products/");
    const canonical = new URL(page === "index.html" ? "" : page, base).href;
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
    if (!title || !description) throw new Error("Missing metadata in " + page);
    html = html.replace(/<link\b[^>]*\brel="canonical"[^>]*>\s*/gi, "")
      .replace(/<meta\b[^>]*(?:property="og:[^"]+"|name="robots")[^>]*>\s*/gi, "");
    const tags = [
      '<link rel="canonical" href="' + escapeAttribute(canonical) + '" />',
      '<meta name="robots" content="' + (indexable ? "index,follow" : "noindex,follow") + '" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:locale" content="uk_UA" />',
      '<meta property="og:site_name" content="Смажена Кава" />',
      '<meta property="og:title" content="' + escapeAttribute(title) + '" />',
      '<meta property="og:description" content="' + description + '" />',
      '<meta property="og:url" content="' + escapeAttribute(canonical) + '" />',
      '<meta property="og:image" content="' + new URL("assets/images/hero-coffee.webp", base).href + '" />',
    ];
    html = html.replace("</head>", "    " + tags.join("\n    ") + "\n  </head>");
    fs.writeFileSync(filename, html);
    if (indexable) links.push(canonical);
  }
  fs.writeFileSync(path.join(directory, "robots.txt"),
    "User-agent: *\nAllow: /\n\nSitemap: " + new URL("sitemap.xml", base).href + "\n");
  fs.writeFileSync(path.join(directory, "sitemap.xml"),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    links.map((url) => "  <url><loc>" + escapeAttribute(url) + "</loc></url>").join("\n") +
    "\n</urlset>\n");
}

module.exports = { generateMetadata };
