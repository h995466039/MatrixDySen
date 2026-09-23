---
name: zyuou-gpt-image
description: Generate images from text prompts via the Zyuou OpenAI-compatible API (default model gpt-image-2.5). Use when the user asks to draw, render, or create a game asset / concept art / sprite / icon / background with this project's image model, or mentions gpt-image, zyuou, 文生图, or 出图.
---

# zyuou-gpt-image

Text-to-image generation for this project's asset pipeline. Calls the
Zyuou OpenAI-compatible `images/generations` endpoint and saves PNGs to
`output/imagegen/` (unverified drafts). Review generated images, then move
approved ones into the real asset directory.

- **Base URL:** `https://api.zyuou.com/v1`
- **Default model:** `gpt-image-2.5`
- **Output dir:** `output/imagegen/`
- **No dependencies** — uses Node `>= 18` global `fetch`.

## Key resolution (first match wins)

1. Environment variable `ZYUOU_API_KEY`
2. `image_key.txt` in the working dir, then walked up to the repo root
3. `--key-file <path>`

The project keeps a plaintext key at repo root `image_key.txt`. If pushing to
a remote, consider adding it to `.gitignore` or switching to `ZYUOU_API_KEY`.

## Usage

Run from anywhere in the repo; paths for `--out` are relative to the cwd.

```bash
# Single image, default model + size (1024x1024)
node .pi/skills/zyuou-gpt-image/generate.js "a red cube on white, studio light"

# Set size, model, and explicit output path
node .pi/skills/zyuou-gpt-image/generate.js "sci-fi factory isometric, dark" \
  --size 1024x1024 --model gpt-image-2.5 --out output/imagegen/factory_iso.png

# Batch (n>1) -> numbered files
node .pi/skills/zyuou-gpt-image/generate.js "alien planet backdrop" --n 3
```

### Options

| Flag | Default | Notes |
|------|---------|-------|
| `--prompt` | positional arg | prompt text |
| `--size` | `1024x1024` | e.g. `512x512`, `1024x1024`, `1536x1024` |
| `--model` | `gpt-image-2.5` | also: `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` |
| `--out` | `output/imagegen/<ts>_<slug>.png` | output file/dir |
| `--n` | `1` | number of images |
| `--response-format` | `b64_json` | `url` to print remote URL instead of saving |
| `--quality` / `--background` / `--moderation` | omitted | passed through when set |
| `--base-url` | `https://api.zyuou.com/v1` | or env `ZYUOU_BASE_URL` |
| `--key-file` | auto | explicit key file path |
| `--timeout-ms` | `180000` | request timeout |

On success it prints a JSON summary (model, size, elapsed seconds, revised
prompt, saved file paths).

## Asset workflow

1. Generate into `output/imagegen/`.
2. Open/inspect the PNG (drafts are unverified).
3. Move approved assets into the game's real resource directory and name them
   per the project's asset convention (see `ASSET_AUDIT.md`).

## Troubleshooting

- **Slow:** one image typically takes ~30–70s. For batches, run several
  `--n` or separate processes in parallel, or raise `--timeout-ms`.
- **`no API key` error:** set `ZYUOU_API_KEY` or ensure `image_key.txt` is
  reachable from cwd.
- **Verify model availability:**
  `curl -s https://api.zyuou.com/v1/models -H "Authorization: Bearer <key>"`
