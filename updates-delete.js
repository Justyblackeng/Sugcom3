// POST /.netlify/functions/updates-delete
// body: { "id": "<update id>" }
//
// Protected endpoint — only signed-in Netlify Identity users can delete
// an update. (Uses POST instead of the DELETE verb so it works reliably
// behind Netlify's redirect/proxy layer, and so it can carry a JSON body.)

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "You must be signed in as an admin to delete updates." }),
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
      body: JSON.stringify({ error: "Missing update id." }),
    };
  }

  try {
    const store = getStore("updates");
    await store.delete(id);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not delete update.", detail: err.message }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, id }),
  };
};
