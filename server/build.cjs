const fs = require("node:fs"),
  path = require("node:path");
require("./layouts.cjs").synchronize();
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "public");
if (path.dirname(out) !== root || path.basename(out) !== "public") throw new Error("Unsafe build path");
if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) throw new Error("Build output must not be a link");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(root))
  if (name.endsWith(".html")) fs.copyFileSync(path.join(root, name), path.join(out, name));
for (const name of ["css", "js", "assets", "products"])
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
console.log("Static site copied to public; server code and database excluded.");
