/**
 * Builds the self-contained clickable demo into demo/dist:
 *   index.html  landing page (admin panel + phone-framed mobile app)
 *   admin.html  admin panel, single file, MemoryRouter, in-browser mock API
 *   app.html    mobile app (Expo web), single file, in-browser mock API
 *
 * Usage: node demo/build.mjs   (from the repo root; runs both builds)
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo", "dist");
const tmp = join(root, "demo", ".build");
const mock = readFileSync(join(root, "demo", "mock-api.js"), "utf8");
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
const MIME = { ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon", ".jpg": "image/jpeg" };

rmSync(tmp, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// ---- Admin ----------------------------------------------------------------
run(`npx vite build --outDir ${join(tmp, "admin")} --emptyOutDir`, join(root, "apps/admin"), { VITE_DEMO: "1" });
{
  const dir = join(tmp, "admin");
  let html = readFileSync(join(dir, "index.html"), "utf8");
  html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/, (_, f) => `<script type="module">${safe(readFileSync(join(dir, f), "utf8"))}</script>`);
  html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/, (_, f) => `<style>${readFileSync(join(dir, f), "utf8")}</style>`);
  html = html.replace("<head>", () => `<head><script>${safe(mock)}</script>`);
  writeFileSync(join(out, "admin.html"), html);
}

// ---- Mobile ---------------------------------------------------------------
const mobile = join(root, "apps/mobile");
const cfg = join(mobile, "app.config.js");
writeFileSync(
  cfg,
  `module.exports = ({ config }) => ({ ...config, web: { ...config.web, output: "single" },
  plugins: config.plugins.map((p) => (p === "expo-router" ? ["expo-router", { asyncRoutes: false }] : p)) });\n`,
);
try {
  run(`npx expo export --platform web --output-dir ${join(tmp, "mobile")} --clear`, mobile, { EXPO_OFFLINE: "1" });
} finally {
  rmSync(cfg, { force: true });
}
{
  const dir = join(tmp, "mobile");
  const jsDir = join(dir, "_expo/static/js/web");
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".js"));
  if (files.length !== 1) throw new Error(`Expected one bundle, got ${files.length}`);
  let js = readFileSync(join(jsDir, files[0]), "utf8");
  // Inline every asset the bundle references (icon font, navigation images).
  js = js.replace(/"(\/assets\/[^"]+)"/g, (m, p) => {
    const file = join(dir, decodeURIComponent(p));
    if (!existsSync(file)) return m;
    return `"data:${MIME[extname(file)] ?? "application/octet-stream"};base64,${readFileSync(file).toString("base64")}"`;
  });
  let html = readFileSync(join(dir, "index.html"), "utf8");
  html = html.replace(/<script src="[^"]+" defer><\/script>/g, "");
  html = html.replace(/<link rel="icon"[^>]*>/, "");
  // expo-router routes on the URL path; start the app at "/" inside the demo frame.
  const boot = `try { history.replaceState(null, "", "/" + location.hash); } catch (e) {}`;
  html = html.replace("<head>", () => `<head><script>${safe(mock)}\n${boot}</script>`);
  // Function replacements: the bundle contains `$'`-style sequences that string replacements would expand.
  html = html.replace("</body>", () => `<script>${safe(js)}</script></body>`);
  writeFileSync(join(out, "app.html"), html);
}

writeFileSync(join(out, "index.html"), readFileSync(join(root, "demo", "landing.html"), "utf8"));
rmSync(tmp, { recursive: true, force: true });
for (const f of readdirSync(out)) console.log(`${f}  ${(readFileSync(join(out, f)).length / 1024).toFixed(0)} KB`);
