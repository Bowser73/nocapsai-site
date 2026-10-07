// assets/js/newsletter.js

const APPS_SCRIPT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzgcasvT2I-_TTlYdR_38_w2bFvkuJhkseF4ulLMWjScHwp3gS9yBmZj511xlwtpjxrZg/exec";

// IMPORTANT:
// This MUST match your Apps Script Script Property that your Code.gs checks.
// In your Code.gs earlier, that property name was FORM_SECRET.
// So set Script Properties: FORM_SECRET = this token.
const NEWSLETTER_SECRET = "591A446526EED06744ABFD9A328EDB09BD05467448D3EA83";

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
