export default async (request, context) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('update');

  // Not a shared-update link — let the normal static page through untouched.
  if (!id) return;

  const response = await context.next();
  let html = await response.text();

  let u = null;
  try {
    const apiRes = await fetch(`${url.origin}/.netlify/functions/updates-list`);
    if (apiRes.ok) {
      const updates = await apiRes.json();
      u = Array.isArray(updates) ? updates.find(x => String(x.id) === String(id)) : null;
    }
  } catch (_) {
    // If the fetch fails, fall through and serve the page with default tags.
  }

  if (!u) {
    return new Response(html, response);
  }

  const title = esc(u.title || 'SUG SUMAS Update');
  const desc = esc((u.excerpt || '').slice(0, 200));
  const image = u.image
    ? (u.image.startsWith('data:')
        ? `${url.origin}/.netlify/functions/update-image?id=${encodeURIComponent(id)}`
        : u.image)
    : null;

  html = html
    .replace(/<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${title}"/>`)
    .replace(/<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${desc}"/>`)
    .replace(/<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${title}"/>`)
    .replace(/<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${desc}"/>`);

  if (image) {
    html = html
      .replace(/<meta property="og:image" content="[^"]*"\/>/, `<meta property="og:image" content="${esc(image)}"/>`)
      .replace(/<meta name="twitter:image" content="[^"]*"\/>/, `<meta name="twitter:image" content="${esc(image)}"/>`)
      // Remove fixed dimensions since the uploaded image likely isn't 512x512.
      .replace(/<meta property="og:image:width" content="[^"]*"\/>\s*/, '')
      .replace(/<meta property="og:image:height" content="[^"]*"\/>\s*/, '');
  }

  const newResponse = new Response(html, response);
  newResponse.headers.set('Content-Type', 'text/html; charset=UTF-8');
  return newResponse;
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
