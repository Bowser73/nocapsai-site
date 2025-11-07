// Azure Functions v4 - Node.js HTTP Trigger for quote requests
// Sends an email and optionally forwards JSON to a Google Apps Script webhook (for Google Sheets)
// Env vars: SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL, SHEETS_WEBHOOK_URL (optional)
import { app } from "@azure/functions";
import sgMail from "@sendgrid/mail";

app.http("quote", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }
    const body = await request.json();
    const { name, email, tools, pain } = body || {};
    if (!name || !email || !tools || !pain) {
      return { status: 400, jsonBody: { error: "Missing fields" }, headers: corsHeaders() };
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: process.env.TO_EMAIL,
        from: process.env.FROM_EMAIL,
        subject: `NoCapsAI Quote Request: ${name}`,
        text: `From: ${name} <${email}>
Tools: ${tools}
Pain Points: ${pain}`,
      });

      // Optional forward to Google Apps Script
      if (process.env.SHEETS_WEBHOOK_URL) {
        await fetch(process.env.SHEETS_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestamp: new Date().toISOString(), name, email, tools, pain })
        });
      }

      return { status: 200, jsonBody: { ok: true }, headers: corsHeaders() };
    } catch (e) {
      context.error(e);
      return { status: 500, jsonBody: { error: "Processing failed" }, headers: corsHeaders() };
    }
  }
});

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
