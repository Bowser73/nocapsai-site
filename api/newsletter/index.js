import { app } from "@azure/functions";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export async function verifyTurnstile(token, remoteIp, fetchImpl = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString()
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && result.action === "newsletter_signup";
}

export async function newsletterHandler(request, context, fetchImpl = fetch) {
  if (request.method === "GET") {
    const siteKey = process.env.TURNSTILE_SITE_KEY;
    return siteKey
      ? { status: 200, headers: JSON_HEADERS, jsonBody: { turnstileSiteKey: siteKey } }
      : { status: 503, headers: JSON_HEADERS, jsonBody: { error: "Newsletter verification is not configured" } };
  }
  const appsScriptUrl = process.env.NEWSLETTER_APPS_SCRIPT_URL;
  const formSecret = process.env.NEWSLETTER_FORM_SECRET;
  if (!appsScriptUrl || !formSecret || !process.env.TURNSTILE_SECRET_KEY) {
    context.error("Newsletter server configuration is incomplete");
    return { status: 503, headers: JSON_HEADERS, jsonBody: { error: "Newsletter signup is unavailable" } };
  }
  let body;
  try { body = await request.json(); }
  catch { return { status: 400, headers: JSON_HEADERS, jsonBody: { error: "Invalid JSON" } }; }
  const email = String(body?.email || "").trim().toLowerCase();
  const fillTime = Number(body?.t);
  if (!EMAIL_RE.test(email) || email.length > 254 || !Number.isFinite(fillTime) || fillTime < 1500 || fillTime > 86400000) {
    return { status: 400, headers: JSON_HEADERS, jsonBody: { error: "Invalid signup" } };
  }
  if (String(body?.hp || "")) return { status: 200, headers: JSON_HEADERS, jsonBody: { ok: true } };
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const remoteIp = forwarded.split(",")[0].trim();
  if (!await verifyTurnstile(String(body?.turnstileToken || ""), remoteIp, fetchImpl)) {
    return { status: 403, headers: JSON_HEADERS, jsonBody: { error: "Verification failed" } };
  }
  const payload = new URLSearchParams({
    kind: "newsletter", secret: formSecret, t: String(fillTime), hp: "", name: "Newsletter", email,
    message: "Newsletter signup", page: String(body?.page || "").slice(0, 500), source: "website"
  });
  try {
    const response = await fetchImpl(appsScriptUrl, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: payload.toString(), redirect: "follow"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(`Apps Script rejected request (${response.status})`);
    return { status: 200, headers: JSON_HEADERS, jsonBody: { ok: true, duplicate: result.duplicate === true } };
  } catch (error) {
    context.error("Newsletter upstream failure", error);
    return { status: 502, headers: JSON_HEADERS, jsonBody: { error: "Signup storage failed" } };
  }
}

app.http("newsletter", {
  methods: ["POST"], authLevel: "anonymous", route: "newsletter", handler: newsletterHandler
});
app.http("newsletterConfig", {
  methods: ["GET"], authLevel: "anonymous", route: "newsletter/config", handler: newsletterHandler
});
