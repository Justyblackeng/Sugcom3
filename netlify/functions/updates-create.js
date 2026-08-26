// POST /.netlify/functions/updates-create
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

const MAX_TITLE = 200;
const MAX_EXCERPT = 1000;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB safety cap on banner image data

exports.handler = async (event, context) => {
  // Everything is wrapped in one top-level try/catch. Without this, a
  // failure OUTSIDE the smaller try/catch blocks below — e.g. the
  // @netlify/blobs module itself failing to load — would crash the
  // function before it ever built a JSON response, and Netlify would
  // return a bare, empty 500 with no way to tell what went wrong. Now,
  // whatever breaks and wherever it breaks, the response always explains
  // why in plain text — check the `detail` field in the response body.
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
    }

    // require() is deliberately done here, inside the try, rather than at
    // the top of the file — so if @netlify/blobs is missing or fails to
    // load, that failure is caught and reported too, instead of crashing
    // the function before handler() even runs.
    const { getStore, connectLambda } = require("@netlify/blobs");
    const crypto = require("crypto");

    // This function uses the classic `exports.handler = async (event, context)`
    // style, which Netlify runs in "Lambda compatibility mode." In that
    // mode, Blobs' siteID/token don't get auto-injected the normal way —
    // connectLambda(event) does that manually. It must be called before
    // getStore() below. This was the actual cause of the
    // MissingBlobsEnvironmentError.
    connectLambda(event);

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
      console.error("updates-create: failed to save to Blobs:", err);
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
  } catch (err) {
    // Catches anything unexpected: a missing/broken @netlify/blobs install,
    // a bad Node version, or any other surprise — logged for the Functions
    // log (once Netlify's logging is back up) AND returned in the response
    // body so it's visible right away in the browser/DevTools too.
    console.error("updates-create: unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error.", detail: err.message }),
    };
  }
};

