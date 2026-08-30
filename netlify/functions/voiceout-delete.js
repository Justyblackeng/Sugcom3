// POST /.netlify/functions/voiceout-delete
// body: { "id": "<feedback id>" }
// Protected endpoint — only signed-in Netlify Identity users can delete a
// feedback item, e.g. once it's been read and handled. (Uses POST instead
// of the DELETE verb for the same reason as updates-delete.js: it works
// reliably behind Netlify's redirect/proxy layer and can carry a JSON body.)

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
    }

    const { getStore, connectLambda } = require("@netlify/blobs");

    // Lambda compatibility mode needs siteID/token injected manually —
    // same fix as the Updates functions.
    connectLambda(event);

    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "You must be signed in as an admin to delete feedback." }),
      };
    }

    let data;
    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    const id = (data.id || "").toString().trim();
    if (!id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing feedback id." }),
      };
    }

    try {
      const store = getStore("voiceout");
      await store.delete(id);
    } catch (err) {
      console.error("voiceout-delete: failed to delete from Blobs:", err);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Could not delete feedback.", detail: err.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (err) {
    console.error("voiceout-delete: unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error.", detail: err.message }),
    };
  }
};
