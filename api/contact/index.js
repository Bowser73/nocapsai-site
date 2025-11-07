// Azure Functions v4 - Node.js HTTP Trigger for contact form
// Requires environment variables: SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL
import { app } from "@azure/functions";
import sgMail from "@sendgrid/mail";

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }
    const body = await request.json();
    const { name, email, message } = body || {};
    if (!name || !email || !message) {
      return { status: 400, jsonBody: { error: "Missing fields" }, headers: corsHeaders() };
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: process.env.TO_EMAIL,
        from: process.env.FROM_EMAIL,
        subject: `NoCapsAI Contact: ${name}`,
        text: `From: ${name} <${email}>

${message}`,
      });
      return { status: 200, jsonBody: { ok: true }, headers: corsHeaders() };
    } catch (e) {
      context.error(e);
      return { status: 500, jsonBody: { error: "Email send failed" }, headers: corsHeaders() };
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
