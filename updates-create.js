// POST /.netlify/functions/updates-create
//
// Protected endpoint — only signed-in Netlify Identity users (SUG officers)
// can publish updates. The browser must send the user's Identity access
// token in the request, e.g.:
//
//   fetch('/.netlify/functions/updates-create', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer ' + netlifyIdentity.currentUser().token.access_token
//     },
//     body: JSON.stringify({ title, excerpt, category, author, date, featured, image })
//   })
//
// Netlify automatically verifies that token and, if valid, populates
// context.clientContext.user for us — no manual JWT verification needed.

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

const MAX_TITLE = 200;
const MAX_EXCERPT = 1000;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB safety cap on banner image data

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // ── Auth check ──────────────────────────────────────────────
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "You must be signed in as an admin to post updates." }),
    };
  }

  // ── Parse & validate input ──────────────────────────────────
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const title = (data.title || "").toString().trim();
  const excerpt = (data.excerpt || "").toString().trim();
  const category = (data.category || "announcement").toString().trim();
  const author = (data.author || "").toString().trim();
  const date = (data.date || new Date().toISOString().slice(0, 10)).toString();
  const featured = !!data.featured;
  const image = (data.image || "").toString();

  if (!title || !excerpt) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Title and Summary are required." }),
    };
  }
  if (title.length > MAX_TITLE || excerpt.length > MAX_EXCERPT) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Title or Summary is too long." }),
    };
  }
  if (image && image.length > MAX_IMAGE_BYTES) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Banner image is too large. Please use a smaller image (under ~1MB)." }),
    };
  }

  const allowedCategories = ["announcement", "event", "achievement", "notice"];
  const safeCategory = allowedCategories.includes(category) ? category : "announcement";

  // ── Save ─────────────────────────────────────────────────────
  const id = crypto.randomUUID();
  const update = {
    id,
    title,
    excerpt,
    category: safeCategory,
    author,
    date,
    featured,
    image, // optional base64 data URL or external image URL
    postedBy: user.email || "unknown",
    createdAt: new Date().toISOString(),
  };

  try {
    const store = getStore("updates");
    await store.setJSON(id, update);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not save update.", detail: err.message }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  };
};
