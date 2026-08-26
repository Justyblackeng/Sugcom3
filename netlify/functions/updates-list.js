// GET /.netlify/functions/updates-list
//
// Public endpoint — anyone visiting the site can read the list of updates.
// No authentication required.

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore("updates");
    const { blobs } = await store.list();

    const updates = [];
    for (const b of blobs) {
      const item = await store.get(b.key, { type: "json" });
      if (item) updates.push(item);
    }

    // Newest first
    updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(updates),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not load updates.", detail: err.message }),
    };
  }
};
