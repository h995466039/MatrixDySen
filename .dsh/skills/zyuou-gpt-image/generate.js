#!/usr/bin/env node
// zyuou-gpt-image — text-to-image via the Zyuou OpenAI-compatible API.
// No dependencies (uses global fetch, Node >= 18).

const fs = require("fs");
const path = require("path");

const DEFAULT_BASE = "https://api.zyuou.com/v1";
const DEFAULT_MODEL = "gpt-image-2.5";

function fail(msg, code = 1) {
  console.error(`[zyuou-gpt-image] ${msg}`);
  process.exit(code);
}

// ---------- arg parsing ----------
const argv = process.argv.slice(2);
function getFlag(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) fail(`--${name} requires a value`);
  return v;
}
function hasFlag(name) {
  return argv.includes(`--${name}`);
}
const positional = argv.filter((a) => !a.startsWith("--") && !["--size", "--out", "--model", "--base-url", "--key-file", "--prompt"].some((f) => a === getFlag(f.slice(2), undefined)));

const prompt = getFlag("prompt", positional.join(" ")).trim();
const model = getFlag("model", process.env.ZYUOU_MODEL || DEFAULT_MODEL);
const size = getFlag("size", "1024x1024");
const out = getFlag("out", "");
const n = parseInt(getFlag("n", "1"), 10);
const base = (getFlag("base-url", process.env.ZYUOU_BASE_URL || DEFAULT_BASE)).replace(/\/+$/, "");
const keyFileArg = getFlag("key-file", "");
const responseFormat = getFlag("response-format", "b64_json"); // b64_json | url
const quality = getFlag("quality", "");
const background = getFlag("background", "");
const moderation = getFlag("moderation", "");
const timeoutMs = parseInt(getFlag("timeout-ms", "180000"), 10);

if (!prompt) fail('usage: generate.js "<prompt>" [--size 1024x1024] [--model gpt-image-2.5] [--out file.png] [--n 1]');

// ---------- key resolution: env -> image_key.txt (walk up) ----------
function findKeyFile(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "image_key.txt");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
function resolveKey() {
  if (process.env.ZYUOU_API_KEY) return process.env.ZYUOU_API_KEY.trim();
  const fromArg = keyFileArg ? path.resolve(keyFileArg) : null;
  const file = fromArg || findKeyFile(process.cwd()) || findKeyFile(__dirname);
  if (file && fs.existsSync(file)) {
    const k = fs.readFileSync(file, "utf8").trim();
    if (k) {
      process.stderr.write(`[zyuou-gpt-image] using key from ${file}\n`);
      return k;
    }
  }
  fail("no API key: set ZYUOU_API_KEY or provide image_key.txt (or --key-file)");
}
const key = resolveKey();

// ---------- output path ----------
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "image";
}
const outDir = path.isAbsolute(out) ? path.dirname(out) : "output/imagegen";
fs.mkdirSync(outDir, { recursive: true });
const ts = Date.now();
const baseName = out && /[\\/]/.test(out) ? path.basename(out) : out ? out : `${ts}_${slug(prompt)}.png`;

// ---------- request ----------
const body = { model, prompt, size, n, response_format: responseFormat };
if (quality) body.quality = quality;
if (background) body.background = background;
if (moderation) body.moderation = moderation;

const url = `${base}/images/generations`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

const t0 = Date.now();
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify(body),
  signal: controller.signal,
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) fail(`HTTP ${res.status}\n${text.slice(0, 2000)}`);
    return JSON.parse(text);
  })
  .then((data) => {
    const items = data.data || [];
    const saved = items.map((item, i) => {
      let filePath;
      if (item.b64_json) {
        const buf = Buffer.from(item.b64_json, "base64");
        filePath = n > 1 ? baseName.replace(/(\.\w+)$/, `_${i}$1`) : baseName;
        const full = path.join(outDir, filePath);
        fs.writeFileSync(full, buf);
        return { file: full, bytes: buf.length };
      } else if (item.url) {
        return { file: item.url, bytes: null, note: "url (not downloaded; use --response-format b64_json to save)" };
      }
      return { file: null, note: "no b64_json/url in item" };
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(JSON.stringify({
      model, size, n, seconds: Number(secs),
      revised_prompt: items[0] && items[0].revised_prompt,
      saved,
    }, null, 2));
  })
  .catch((e) => fail(e.name === "AbortError" ? `timed out after ${timeoutMs}ms` : e.message))
  .finally(() => clearTimeout(timer));
