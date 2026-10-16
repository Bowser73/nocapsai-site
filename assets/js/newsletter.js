// assets/js/newsletter.js
//
// Newsletter signup for the "Stay in the Loop" form.
// Bot protection is Cloudflare Turnstile, verified server-side by the Apps Script receiver
// (integrations/google-apps-script/Code.gs). Nothing secret lives in this file: the Turnstile
// SITE key is public by design; the Turnstile SECRET key exists only in Apps Script
// Script Properties. Fill-time and honeypot fields are extra, cheap signals for the server.

const APPS_SCRIPT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzgcasvT2I-_TTlYdR_38_w2bFvkuJhkseF4ulLMWjScHwp3gS9yBmZj511xlwtpjxrZg/exec";

// Public Turnstile site key for nocapsai.com (Cloudflare dashboard > Turnstile > widget > Site Key).
// Left empty, the form fails closed and asks people to email instead.
const TURNSTILE_SITE_KEY = "0x4AAAAAAFYBEpJyv5cYOfkM";
const TURNSTILE_ACTION = "newsletter_signup";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const PAGE_LOADED_AT = Date.now();

(() => {
  const heading = Array.from(document.querySelectorAll("h1,h2,h3,h4"))
    .find(el => el.textContent.trim().toLowerCase() === "stay in the loop");

  if (!heading) {
    console.warn("[newsletter] 'Stay in the Loop' heading not found.");
    return;
  }

  const root = heading.closest("section, footer, div") || heading.parentElement;

  const emailInput =
    root.querySelector('input[type="email"]') ||
    root.querySelector('input[placeholder*="email" i]') ||
    root.querySelector("input");

  const signUpBtn =
    Array.from(root.querySelectorAll("button,a"))
      .find(el => el.textContent.trim().toLowerCase() === "sign up");

  if (!emailInput || !signUpBtn) {
    console.warn("[newsletter] email input or sign up button not found.");
    return;
  }

  // Honeypot: hidden from people and screen readers; automated form-fillers tend to fill it.
  const honeypot = document.createElement("input");
  honeypot.type = "text";
  honeypot.name = "company_website";
  honeypot.tabIndex = -1;
  honeypot.autocomplete = "off";
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;opacity:0;";
  root.appendChild(honeypot);

  // Container for the Turnstile widget, placed directly under the email form so people see it
  // before pressing Sign Up (falls back to the end of the section if there is no <form>).
  const widgetBox = document.createElement("div");
  widgetBox.className = "newsletter-turnstile";
  widgetBox.style.cssText = "margin:10px auto 0;display:flex;justify-content:center;";
  const formEl = emailInput.closest("form");
  if (formEl && typeof formEl.after === "function") formEl.after(widgetBox); else root.appendChild(widgetBox);

  let status = root.querySelector(".newsletter-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "newsletter-status";
    status.style.marginTop = "10px";
    status.style.fontSize = "14px";
    if (typeof widgetBox.after === "function" && widgetBox.parentNode) widgetBox.after(status); else root.appendChild(status);
  }

  status.id = status.id || "newsletter-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const describedBy = emailInput.getAttribute("aria-describedby") || "";
  emailInput.setAttribute("aria-describedby", `${describedBy} ${status.id}`.trim());
  if (!emailInput.getAttribute("aria-label") && !emailInput.labels?.length) {
    emailInput.setAttribute("aria-label", "Email address");
  }
  emailInput.setAttribute("autocomplete", "email");

  let inFlight = false;
  let widgetId = null;
  let token = "";

  const setStatus = (msg, ok = true) => {
    status.textContent = msg;
    status.style.opacity = "1";
    status.style.color = ok ? "#eafff6" : "#FF9A9A";
  };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(s || "").trim());

  const unavailable = () =>
    setStatus("Newsletter signup is temporarily unavailable. Please email info@nocapsai.com to join.", false);

  function renderWidget() {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || widgetId !== null) return;
    widgetId = window.turnstile.render(widgetBox, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
      callback: (t) => { token = t; },
      "expired-callback": () => { token = ""; },
      "error-callback": () => { token = ""; }
    });
  }

  function resetWidget() {
    token = "";
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  if (TURNSTILE_SITE_KEY) {
    if (window.turnstile) {
      renderWidget();
    } else {
      const s = document.createElement("script");
      s.src = TURNSTILE_SCRIPT;
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      s.onerror = unavailable;
      (document.head || root).appendChild(s);
    }
  }

  const MESSAGES = {
    subscribed: "Thanks! You're on the list.",
    duplicate: "You're already on the list. Thanks!",
    verification: "We couldn't verify the request. Please complete the check and try again.",
    invalid: "Enter a valid email address.",
    unavailable: "Newsletter signup is temporarily unavailable. Please email info@nocapsai.com to join.",
    failed: "Something went wrong saving your signup. Please try again or email info@nocapsai.com."
  };

  async function submitNewsletter() {
    if (inFlight) return;
    const email = String(emailInput.value || "").trim();
    emailInput.value = email;

    if (!isEmail(email) || !emailInput.checkValidity()) {
      emailInput.setAttribute("aria-invalid", "true");
      setStatus(MESSAGES.invalid, false);
      emailInput.focus();
      return;
    }
    emailInput.removeAttribute("aria-invalid");

    if (!TURNSTILE_SITE_KEY) { unavailable(); return; }
    if (!token) {
      setStatus("Please complete the verification check above, then press Sign Up.", false);
      return;
    }

    inFlight = true;
    signUpBtn.setAttribute("aria-disabled", "true");
    root.setAttribute("aria-busy", "true");
    setStatus("Sending signup request...");
    const oldText = signUpBtn.textContent;
    signUpBtn.style.pointerEvents = "none";
    signUpBtn.style.opacity = "0.75";
    if (signUpBtn.tagName.toLowerCase() === "button") signUpBtn.disabled = true;
    signUpBtn.textContent = "Sending...";

    try {
      const payload = new URLSearchParams({
        kind: "newsletter",
        turnstileToken: token,
        t: String(Date.now() - PAGE_LOADED_AT),
        hp: honeypot.value || "",
        email,
        page: window.location.href,
        source: "website"
      });

      // A simple (form-encoded) POST: no preflight. Apps Script answers with JSON and
      // Access-Control-Allow-Origin: *, so the result can be shown honestly.
      const response = await fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload.toString()
      });
      const result = await response.json().catch(() => ({}));

      if (result.ok === true) {
        setStatus(result.duplicate ? MESSAGES.duplicate : MESSAGES.subscribed);
        emailInput.value = "";
      } else {
        const key = { verification_failed: "verification", "invalid email": "invalid",
                      "server not configured": "unavailable" }[result.error] || "failed";
        setStatus(MESSAGES[key], false);
      }
    } catch (err) {
      console.error("[newsletter] request failed:", err);
      setStatus("Network error. Please try again.", false);
    } finally {
      resetWidget(); // Turnstile tokens are single-use.
      inFlight = false;
      signUpBtn.removeAttribute("aria-disabled");
      root.removeAttribute("aria-busy");
      signUpBtn.style.pointerEvents = "";
      signUpBtn.style.opacity = "";
      if (signUpBtn.tagName.toLowerCase() === "button") signUpBtn.disabled = false;
      signUpBtn.textContent = oldText;
    }
  }

  const form = emailInput.closest("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitNewsletter();
    });
  }

  signUpBtn.addEventListener("click", (e) => {
    e.preventDefault();
    submitNewsletter();
  });

  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitNewsletter();
    }
  });
})();
