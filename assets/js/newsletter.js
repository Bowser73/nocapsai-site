// Newsletter requests stay same-origin. The server verifies Turnstile and adds the
// private Apps Script secret; no credential is shipped to the browser.
const NEWSLETTER_API = "/api/newsletter";
const NEWSLETTER_CONFIG_API = "/api/newsletter/config";
const PAGE_LOADED_AT = Date.now();

(() => {
  const heading = Array.from(document.querySelectorAll("h1,h2,h3,h4"))
    .find(el => el.textContent.trim().toLowerCase() === "stay in the loop");
  if (!heading) return;
  const root = heading.closest("section, footer, div") || heading.parentElement;
  const emailInput = root.querySelector('input[type="email"]') ||
    root.querySelector('input[placeholder*="email" i]') || root.querySelector("input");
  const signUpBtn = Array.from(root.querySelectorAll("button,a"))
    .find(el => el.textContent.trim().toLowerCase() === "sign up");
  if (!emailInput || !signUpBtn) return;

  const honeypot = document.createElement("input");
  honeypot.type = "text";
  honeypot.name = "company_website";
  honeypot.tabIndex = -1;
  honeypot.autocomplete = "off";
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;opacity:0;";
  root.appendChild(honeypot);

  const challenge = document.createElement("div");
  challenge.className = "newsletter-challenge";
  root.appendChild(challenge);

  let status = root.querySelector(".newsletter-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "newsletter-status";
    status.style.cssText = "margin-top:10px;font-size:14px";
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
  let turnstileToken = "";
  let turnstileWidget;
  const setStatus = (message, ok = true) => {
    status.textContent = message;
    status.style.opacity = "1";
    status.style.color = ok ? "#eafff6" : "#FF9A9A";
  };
  const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());

  async function loadTurnstile() {
    const response = await fetch(NEWSLETTER_CONFIG_API, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Newsletter verification is not configured");
    const { turnstileSiteKey } = await response.json();
    if (!turnstileSiteKey) throw new Error("Newsletter verification is not configured");
    await new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    turnstileWidget = window.turnstile.render(challenge, {
      sitekey: turnstileSiteKey, action: "newsletter_signup", theme: "dark",
      callback: token => { turnstileToken = token; },
      "expired-callback": () => { turnstileToken = ""; },
      "error-callback": () => { turnstileToken = ""; setStatus("Verification failed. Please retry.", false); }
    });
  }
  loadTurnstile().catch(() => setStatus("Newsletter signup is temporarily unavailable.", false));

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
    if (!turnstileToken) {
      setStatus("Complete the verification before signing up.", false);
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
      const response = await fetch(NEWSLETTER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, turnstileToken, t: Date.now() - PAGE_LOADED_AT,
          hp: honeypot.value || "", page: window.location.href })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Signup failed");
      setStatus(result.duplicate ? "You are already subscribed." : "You're subscribed. Thank you!");
      if (!result.duplicate) emailInput.value = "";
    } catch (error) {
      console.error("[newsletter] request failed:", error);
      setStatus("We could not complete signup. Please try again.", false);
    } finally {
      turnstileToken = "";
      if (window.turnstile && turnstileWidget !== undefined) window.turnstile.reset(turnstileWidget);
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
  if (form) form.addEventListener("submit", event => { event.preventDefault(); submitNewsletter(); });
  signUpBtn.addEventListener("click", event => { event.preventDefault(); submitNewsletter(); });
  emailInput.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); submitNewsletter(); }
  });
})();
