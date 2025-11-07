# NoCapsAI Starter — Deploy on Azure (keep Shopify live)

## Files
- `index.html` — branded landing page
- `styles.css` — monochrome theme
- `assets/brand-hero.webp` — optimized from your AI art (square)
- `assets/logo-mark.png` — simple silhouette mark
- `assets/favicon.ico` — site icon
- `assets/social-banner.png` — header for social profiles
- `assets/ai-audit-checklist.pdf` — free download
- `api/contact/index.js` — Azure Function (SendGrid email)
- `api/quote/index.js` — Azure Function (email + optional Google Sheets webhook)

## Quick Deploy (Azure Static Web Apps — Free)
1. Create GitHub repo (e.g., `nocapsai-site`) and add these files.
2. Azure Portal → Create resource → Static Web App (Free) → connect repo.
   - Build preset: **Custom** (or framework if you add one later)
   - App location: `/`
   - Output location: `/`
3. After first deploy, you get a public URL with free HTTPS.

## Add Staging Domain (GoDaddy)
- Create CNAME at GoDaddy:
  - Host: `beta`
  - Points to: your Azure SWA hostname (e.g., `*.azurestaticapps.net`)
- In Azure SWA → Custom domains → add `beta.nocapsai.net`

## Go Live (later) while leaving Shopify up now
- Keep `nocapsai.com` at Shopify for now.
- When ready to flip:
  - `www.nocapsai.com` → CNAME → Azure SWA hostname
  - `nocapsai.com` (apex) → 301 Forward → `https://www.nocapsai.com`
  - Remove Shopify A/CNAME records
  - Add 301 redirects from `nocapai.*` to `https://www.nocapsai.com`

## Configure Email (Azure Functions)
- Create a **Functions** app (Node v18+) or add SWA API.
- Set env vars:
  - `SENDGRID_API_KEY`
  - `TO_EMAIL` (your inbox)
  - `FROM_EMAIL` (verified sender in SendGrid)
  - `SHEETS_WEBHOOK_URL` (optional Apps Script endpoint)
- Deploy the `api/` folder with your SWA or Functions app.

### Google Sheets Webhook (optional)
- Create Google Apps Script (web app) that appends JSON to a spreadsheet.
- Deploy as web app (Anyone can access). Paste URL into `SHEETS_WEBHOOK_URL`.

## Notes
- Monochrome style is easy to re-theme later.
- Replace `assets/brand-hero.webp` with any image; keep it square.
- All pages include header/footer branding as requested.
