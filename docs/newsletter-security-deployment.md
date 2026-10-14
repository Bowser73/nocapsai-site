# Newsletter security deployment

This change is intentionally fail-closed until all three systems are configured together. Do not deploy only the client change.

## Required authorization

1. Editor access to the Google Apps Script project behind deployment `AKfycbzgcasvT2I-_TTlYdR_38_w2bFvkuJhkseF4ulLMWjScHwp3gS9yBmZj511xlwtpjxrZg`, plus edit access to its spreadsheet.
2. Contributor access to the NoCapsAI Azure Static Web App so application settings and a staging deployment can be managed.
3. Permission to create a free Cloudflare Turnstile widget for the production and staging NoCapsAI hostnames. No paid plan is required.

## Rotation and deployment order

1. Back up the spreadsheet (File > Make a copy) and record its row count. Do not rename or delete the current sheet.
2. Review the live Apps Script `Code.gs` before replacement. Confirm the existing sheet's header row contains `Email`; set `NEWSLETTER_SHEET_NAME` to that exact existing tab name. The versioned receiver appends mapped values and never edits or deletes rows.
3. Generate one new cryptographically random value (at least 32 bytes). Put it in Apps Script **Project Settings > Script Properties** as `FORM_SECRET`. Put the identical value in Azure Static Web App configuration as `NEWSLETTER_FORM_SECRET`. Never commit it or send it to the browser.
4. Set Azure values `NEWSLETTER_APPS_SCRIPT_URL`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`. The Turnstile secret is private; its site key is public.
5. Deploy Apps Script as a new web-app version, executing as the owner and allowing anonymous access. Keep the same deployment URL if possible.
6. Deploy this site to staging. Test: valid signup adds exactly one row; repeating it returns `duplicate` and adds no row; invalid email, empty/expired Turnstile token, filled honeypot, and too-fast submission add no rows.
7. Compare the spreadsheet row count and spot-check all pre-existing rows. Only then promote the website deployment. Revoke the old `FORM_SECRET` by ensuring it exists nowhere in Script Properties or Azure configuration.

## Rollback

Roll back the website and Apps Script deployment versions together. Restoring code does not require restoring or replacing the spreadsheet; signup storage is append-only.
