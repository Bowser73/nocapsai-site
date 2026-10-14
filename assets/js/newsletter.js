// assets/js/newsletter.js

const APPS_SCRIPT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzgcasvT2I-_TTlYdR_38_w2bFvkuJhkseF4ulLMWjScHwp3gS9yBmZj511xlwtpjxrZg/exec";

// Form key for the Apps Script endpoint (rotated 2026-10-14).
// This value is visible to anyone who views the page, so it is NOT a security control on its own.
// Abuse protection lives server-side in Code.gs: fill-time and honeypot checks, rate limits,
// duplicate prevention, validation, and no automatic emails to the submitted address.
const NEWSLETTER_SECRET = "23DDDDA126981E83136C51E30ED4D60279CABD8AF7048FC9";
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

  let status = root.querySelector(".newsletter-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "newsletter-status";
    status.style.marginTop = "10px";
    status.style.fontSize = "14px";
    root.appendChild(status);
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

  const setStatus = (msg, ok = true) => {
    status.textContent = msg;
    status.style.opacity = "1";
    status.style.color = ok ? "#eafff6" : "#FF9A9A";
  };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(s || "").trim());

  async function submitNewsletter() {
    if (inFlight) return;
    const email = String(emailInput.value || "").trim();
    emailInput.value = email;

    if (!isEmail(email) || !emailInput.checkValidity()) {
      emailInput.setAttribute("aria-invalid", "true");
      setStatus("Enter a valid email address.", false);
      emailInput.focus();
      return;
    }

    emailInput.removeAttribute("aria-invalid");
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
        secret: NEWSLETTER_SECRET,
        t: String(Date.now() - PAGE_LOADED_AT),
        hp: honeypot.value || "",
        name: "Newsletter",
        email,
        message: "Newsletter signup",
        page: window.location.href,
        source: "website"
      });

      // NOTE: no-cors because Apps Script usually doesn't send CORS headers.
      await fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload.toString()
      });

      // A no-cors response is opaque: it cannot confirm server acceptance.
      setStatus("Signup request sent, but we cannot confirm your subscription here. If you need help, email info@nocapsai.com.");
    } catch (err) {
      console.error("[newsletter] request failed:", err);
      setStatus("Network error. Please try again.", false);
    } finally {
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
