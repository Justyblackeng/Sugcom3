// GET /.netlify/functions/voiceout-list
//
// Protected endpoint — unlike updates-list.js, this one requires a
// signed-in Netlify Identity user. Feedback submissions carry a
// student's name, matric number, department and email, so only officers
// logged into the admin panel should be able to read them back.
//
//   fetch('/.netlify/functions/voiceout-list', {
//     headers: { 'Authorization': 'Bearer ' + netlifyIdentity.currentUser().token.access_token }
//   })

exports.handler = async (event, context) => {
  try {
    const { getStore, connectLambda } = require("@netlify/blobs");

    // Lambda compatibility mode needs siteID/token injected manually —
    // same fix as the Updates functions.
    connectLambda(event);

    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "You must be signed in as an admin to view feedback." }),
      };
    }

    const store = getStore("voiceout");
    const { blobs } = await store.list();

    const feedback = [];
    for (const b of blobs) {
      const item = await store.get(b.key, { type: "json" });
      if (item) feedback.push(item);
    }

    // Newest first
    feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(feedback),
    };
  } catch (err) {
    console.error("voiceout-list: unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not load feedback.", detail: err.message }),
    };
  }
};
