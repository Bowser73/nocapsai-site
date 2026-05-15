# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

NoCapsAI is a **no-build static website** deployed to Azure Static Web Apps. There is no package.json, no bundler, and no framework — files are served as-is directly from the repo root.

## Serving Locally

Use any static file server from the repo root:
```bash
python3 -m http.server 8080
# or
npx serve .
```

The `api/` Azure Function code is not needed for front-end development and requires Azure Functions Core Tools to run locally.

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/main.yml`) deploys automatically to Azure Static Web Apps. The workflow sets `skip_app_build: true` because there is no framework build step. `CNAME` is set to `nocapsai.com`.

The `api/` folder is intended to be deployed separately as an Azure Functions app (Node v18+) with the required environment variables set in Azure:
- `SENDGRID_API_KEY`, `TO_EMAIL`, `FROM_EMAIL` — required for both functions
- `SHEETS_WEBHOOK_URL` — optional; only the quote function uses it to forward data to Google Sheets

## Architecture

### Pages and Styling

Three pages exist as plain HTML files:

- `index.html` — main landing page; links to the shared `styles.css`
- `services/index.html` — services detail page; has its own scoped `<style>` block
- `marketing/index.html` — marketing/content page; has its own scoped `<style>` block

**Critical style split**: `styles.css` is loaded only by `index.html` and uses `#00ff7f` / `#001a33` as the primary palette. The subpages each have inline `<style>` blocks using a CSS custom-properties system (`--green: #3CFF9A`, `--bg: #0a1822`, etc.). Changes to `styles.css` have no effect on subpages, and vice versa.

### Asset Paths

`index.html` references assets with root-relative paths (`assets/logo-1.png`). Subpages use relative paths (`../assets/logo-1.png`). Keep this pattern consistent when adding assets.

### JavaScript Widgets

Both widgets are self-contained IIFEs in `assets/js/`.

**`chat-widget.js`** — Floating AI chat bubble loaded on all three pages. Calls an Azure-hosted proxy at `https://nocapsai-proxy.azurewebsites.net/api/proxy`, which fronts the OpenAI Assistants API. The assistant ID (`asst_EctRolLhzorePFUEUVTaTYlA`) is hardcoded in this file. Thread state lives in memory only — it resets on page reload. Polls the run status every 1.2 s until the run completes or fails.

**`newsletter.js`** — Loaded only on `index.html`. Submits email signups to a Google Apps Script endpoint via `no-cors` POST (meaning there is never a real success/failure response — only hard network errors are catchable). The endpoint URL and `NEWSLETTER_SECRET` token are both hardcoded in this file. The script locates the form by finding a heading with the text "Stay in the Loop", so that heading text must stay exactly as-is.

### Azure Functions

`api/contact/index.js` and `api/quote/index.js` use the **Azure Functions v4 ESM API** (`import { app } from "@azure/functions"`). Both handle OPTIONS preflight for CORS and return `Access-Control-Allow-Origin: *`. The quote function additionally POSTs JSON to `SHEETS_WEBHOOK_URL` when that env var is present.

### Copyright Year

The footer in `index.html` uses a `data-year` attribute pattern — a small inline `<script>` at the bottom of the page queries `[data-year]` and fills in `new Date().getFullYear()`. Do not remove this script or the attribute.
