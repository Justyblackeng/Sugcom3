// POST /.netlify/functions/voiceout-create
// Public endpoint — any student can submit Voice Out feedback. No sign-in
// required (this is the whole point: students shouldn't need an admin
// account to complain, suggest, or compliment). Officers read these back
// via voiceout-list.js, which IS protected.
//
//   fetch('/.netlify/functions/voiceout-create', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ name, matric, department, email, category, office, message })
//   })

const MAX_FIELD = 200;
const MAX_MESSAGE = 3000;
const ALLOWED_CATEGORIES = ["Suggestion", "Complaint", "Compliment", "Other"];

exports.handler = async (event) => {
  // Single top-level try/catch — see updates-create.js for why: any
  // failure (even @netlify/blobs failing to load) should still come back
  // as a JSON body with a `detail` field, not a bare unexplained 500.
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
    }

    const { getStore, connectLambda } = require("@netlify/blobs");
    const crypto = require("crypto");

    // Lambda compatibility mode needs siteID/token injected manually —
    // same fix as the Updates functions, for the same
    // MissingBlobsEnvironmentError.
    connectLambda(event);

    // ── Parse & validate input ──────────────────────────────────
    let data;
    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    const name = (data.name || "").toString().trim();
    const matric = (data.matric || "").toString().trim();
    const department = (data.department || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const category = (data.category || "").toString().trim();
    const office = (data.office || "").toString().trim();
    const message = (data.message || "").toString().trim();

    if (!name || !matric || !department || !email || !category || !office || !message) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "All fields are required." }),
      };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Please provide a valid email address." }),
      };
    }
    if ([name, matric, department, email, office].some((f) => f.length > MAX_FIELD)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "One of the fields is too long." }),
      };
    }
    if (message.length > MAX_MESSAGE) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message is too long (max 3000 characters)." }),
      };
    }

    const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : "Other";

    // ── Save ─────────────────────────────────────────────────────
    const id = crypto.randomUUID();
    const feedback = {
      id,
      name,
      matric,
      department,
      email,
      category: safeCategory,
      office,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const store = getStore("voiceout");
      await store.setJSON(id, feedback);
    } catch (err) {
      console.error("voiceout-create: failed to save to Blobs:", err);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Could not save feedback.", detail: err.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (err) {
    console.error("voiceout-create: unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error.", detail: err.message }),
    };
  }
};
