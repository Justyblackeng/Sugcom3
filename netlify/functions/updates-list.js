// GET /.netlify/functions/updates-list
//
// Public endpoint — anyone visiting the site can read the list of updates.
// No authentication required.

exports.handler = async (event) => {
  try {
    const { getStore, connectLambda } = require("@netlify/blobs");

    // This function runs in "Lambda compatibility mode," where Blobs'
    // siteID/token must be injected manually via connectLambda(event)
    // before getStore() — the same fix applied to updates-create.js and
    // updates-delete.js, for the same MissingBlobsEnvironmentError.
    connectLambda(event);

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
    console.error("updates-list: unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not load updates.", detail: err.message }),
    };
  }
};
