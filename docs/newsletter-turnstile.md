# Newsletter signup: Cloudflare Turnstile + Apps Script

Host: GitHub Pages (`main`, `/`). No server, no Azure, no paid services.

## How it works
1. `assets/js/newsletter.js` renders a Turnstile widget (public **site key**) and posts
   `email`, `turnstileToken`, fill time `t` and honeypot `hp` to the Apps Script web app.
2. `integrations/google-apps-script/Code.gs` verifies the token with Cloudflare's siteverify
   API using the **secret key** stored only in Script Properties, checks action
   `newsletter_signup` and hostname, then appends one row to the existing signup tab.
3. No email is sent by the script. Existing rows are never edited or deleted.

## Script Properties
| Property | Value |
| --- | --- |
| `TURNSTILE_SECRET` | Turnstile secret key (never commit it) |
| `NEWSLETTER_SHEET_NAME` | exact name of the existing signup tab |
| `TURNSTILE_ALLOWED_HOSTS` | optional; default `nocapsai.com,www.nocapsai.com` |
| `FORM_SECRET` | delete after the new version is live |

## Release order (Apps Script first, then the website)
1. Back up the spreadsheet (File > Make a copy) and note its row count.
2. Paste the new `Code.gs`, set the properties, Deploy > Manage deployments > edit the
   existing deployment > New version (keeps the same `/exec` URL).
   Between this step and step 3 the live form is rejected (old page sends no token): keep it short.
3. Put the public site key in `TURNSTILE_SITE_KEY` in `newsletter.js` and merge to `main`.
   The same merge removes `.github/workflows/main.yml` (obsolete Azure deploy). GitHub Pages
   deploys from its own built-in `pages-build-deployment`, not from that file.
4. Verify: one real signup adds exactly one row; repeating it adds none; a bad token and a
   honeypot submission add none; the owner's Gmail Sent folder shows no auto-reply.

## Rollback
Redeploy the previous Apps Script version and revert the website commit together.

## Tests
`node --test tests/*.cjs` (client behaviour and the Apps Script receiver with stubbed services).
