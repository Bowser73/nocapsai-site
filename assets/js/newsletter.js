// assets/js/newsletter.js

const APPS_SCRIPT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzgcasvT2I-_TTlYdR_38_w2bFvkuJhkseF4ulLMWjScHwp3gS9yBmZj511xlwtpjxrZg/exec";

// IMPORTANT: This MUST match your Apps Script Script Property: NEWSLETTER_SECRET
// Quick + simple: use the same token you already had working:
const NEWSLETTER_SECRET = "591A446526EED06744ABFD9A328EDB09BD05467448D3EA83";

(() => {
  // Find the "Stay in the Loop" section area
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

  // A little status line under the form (reuse existing if you already have one)
  let status = root.querySelector(".newsletter-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "newsletter-status";
    status.style.marginTop = "10px";
    status.style.fontSize = "14px";
    root.appendChild(status);
  }

  const setStatus = (msg, ok = true) => {
    status.textContent = msg;
    status.style.opacity = "1";
    status.style.color = ok ? "#7CFFB2" : "#FF9A9A"; // light green / light red
  };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(s || "").trim());

  async function submitNewsletter() {
    const email = String(emailInput.value || "").trim();

    if (!isEmail(email)) {
      setStatus("Enter a valid email address.", false);
      emailInput.focus();
      return;
    }

    // Disable while sending
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

      const res = await fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload.toString()
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}

      if (!res.ok || (data && data.ok === false)) {
        console.error("[newsletter] error response:", res.status, text);
        setStatus("Signup failed. Please try again in a moment.", false);
        return;
      }

      setStatus("✅ You’re signed up. Check your inbox (and spam) for the confirmation.");
      emailInput.value = "";
    } catch (err) {
      console.error("[newsletter] request failed:", err);
      setStatus("Network error. Please try again.", false);
    } finally {
      // Re-enable
      signUpBtn.style.pointerEvents = "";
      signUpBtn.style.opacity = "";
      if (signUpBtn.tagName.toLowerCase() === "button") signUpBtn.disabled = false;
      signUpBtn.textContent = oldText;
    }
  }

  // Button click
  signUpBtn.addEventListener("click", (e) => {
    e.preventDefault();
    submitNewsletter();
  });

  // Enter key in email input
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitNewsletter();
    }
  });
})();
