// Azure Functions v4 - Node.js HTTP Trigger for contact form
// Required env vars: SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL
// Optional env vars: NOTION_TOKEN, NOTION_LEADS_DB_ID (auto-creates Notion lead)
import { app } from "@azure/functions";
import sgMail from "@sendgrid/mail";

const LEADS_DB_ID = process.env.NOTION_LEADS_DB_ID || "af888b2a3ad1822e9ae701a4200a85b1";

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return { status: 204, headers: corsHeaders() };
    }
    const body = await request.json();
    const { name, email, message, phone = "", service = "", source = "website" } = body || {};
    if (!name || !email || !message) {
      return { status: 400, jsonBody: { error: "Missing required fields: name, email, message" }, headers: corsHeaders() };
    }

    const results = await Promise.allSettled([
      sendEmail({ name, email, message, phone, service }),
      createNotionLead({ name, email, message, phone, service, source }, context),
    ]);

    const emailOk = results[0].status === "fulfilled";
    if (!emailOk) {
      context.error("Email failed:", results[0].reason);
      return { status: 500, jsonBody: { error: "Email send failed" }, headers: corsHeaders() };
    }

    if (results[1].status === "rejected") {
      context.warn("Notion lead creation skipped or failed:", results[1].reason?.message);
    }

    return { status: 200, jsonBody: { ok: true }, headers: corsHeaders() };
  }
});

async function sendEmail({ name, email, message, phone, service }) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const lines = [
    `From: ${name} <${email}>`,
    phone ? `Phone: ${phone}` : null,
    service ? `Service interest: ${service}` : null,
    "",
    message,
  ].filter(l => l !== null);
  await sgMail.send({
    to: process.env.TO_EMAIL,
    from: process.env.FROM_EMAIL,
    subject: `NoCapsAI Inquiry: ${name}${service ? ` — ${service}` : ""}`,
    text: lines.join("\n"),
  });
}

async function createNotionLead({ name, email, message, phone, service, source }, context) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return;

  const sourceMap = {
    "website": "🔍 Search Engines",
    "social": "📱 Social Media",
    "referral": "🗣️ Word of Mouth",
    "ad": "📢 Online Advertisement",
  };

  const properties = {
    "Lead Name": { title: [{ text: { content: name } }] },
    "Contact Email": { email },
    "What the client wants?": { rich_text: [{ text: { content: message } }] },
    "Notes": { rich_text: [{ text: { content: service || "" } }] },
    "Status": { select: { name: "🆕 New" } },
    "Priority": { select: { name: "🟡 Medium" } },
    "Tags": { multi_select: [{ name: "👋 First Contact" }] },
  };

  if (phone) properties["Contact Phone"] = { phone_number: phone };
  if (sourceMap[source]) properties["How did you hear about this offer?"] = { select: { name: sourceMap[source] } };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ parent: { database_id: LEADS_DB_ID }, properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }

  context.log("Notion lead created for:", email);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
