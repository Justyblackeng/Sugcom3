exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: 'Missing id' };
  }

  try {
    const res = await fetch(`${process.env.URL}/.netlify/functions/updates-list`);
    if (!res.ok) return { statusCode: 502, body: 'Could not load updates' };
    const updates = await res.json();
    const u = Array.isArray(updates) ? updates.find(x => String(x.id) === String(id)) : null;

    if (!u || !u.image) {
      return { statusCode: 404, body: 'No image for this update' };
    }

    const match = u.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return { statusCode: 404, body: 'Image is not in expected format' };
    }

    const [, mimeType, base64Data] = match;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
      body: base64Data,
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};
