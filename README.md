# SUG SUMAS Website — Backend Setup

This adds a **real backend** to the "Post a New Update" admin panel. Before
this, publishing an update only changed what *you* saw in your own browser —
nothing was saved, so it vanished on refresh and no one else ever saw it.
Now, published updates are actually stored and served to every visitor.

## How it works

- **Auth:** [Netlify Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/)
  — officers sign up / log in with email + password. Already wired into
  `index.html`.
- **Storage:** [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
  — a simple built-in key/value store. No external database to set up or pay for.
- **API:** three [Netlify Functions](https://docs.netlify.com/build/functions/overview/)
  (serverless, run automatically by Netlify):

| Function | Method | Auth required | What it does |
|---|---|---|---|
| `/.netlify/functions/updates-list` | GET | No (public) | Returns all published updates as JSON |
| `/.netlify/functions/updates-create` | POST | Yes | Publishes a new update |
| `/.netlify/functions/updates-delete` | POST | Yes | Deletes an update by id |

The admin panel's "Publish Update" button calls `updates-create` with the
signed-in officer's Identity token. The Updates page calls `updates-list` on
load to display everything that's actually been published, for every visitor.

## File structure

```
.
├── index.html                  ← the website (rename kept as index.html)
├── netlify.toml                ← tells Netlify where the site & functions live
├── package.json                ← declares the @netlify/blobs dependency
├── netlify/functions/
│   ├── updates-list.js
│   ├── updates-create.js
│   └── updates-delete.js
└── *.png / *.jpg               ← all leadership photos & site images
```

## Deploying — step by step

1. **Push this whole folder to a GitHub/GitLab/Bitbucket repo.**
   (Netlify Functions + Blobs require a proper Netlify build — a plain
   drag-and-drop of a single HTML file won't run the backend. Git-based
   deploys, or the Netlify CLI, both work fine.)

2. **In Netlify:** *Add new site → Import an existing project* → pick your
   repo. Build settings can stay default — `netlify.toml` already tells
   Netlify the publish folder is `.` and functions live in
   `netlify/functions`.

3. **Enable Identity:** Site configuration → Identity → **Enable Identity**.
   - Under *Registration preferences*, set it to **Invite only** once your
     real officers have accounts, so random visitors can't self-register as
     admins.
   - Optional but recommended: invite yourself first from that same screen
     to create the first admin account.

4. **Functions & Blobs need no extra setup** — once your repo has the
   `netlify/functions` folder and `@netlify/blobs` in `package.json`,
   Netlify installs dependencies and deploys the functions automatically on
   every deploy. Netlify Blobs is automatically available to functions
   running on Netlify — nothing to provision.

5. **Deploy.** Once live, go to `https://yoursite.netlify.app/?admin=1`,
   log in (or sign up, if you haven't restricted registration yet), and try
   publishing an update. Refresh the page, or open it in an incognito
   window — the update should now be visible to everyone, not just you.

## Restricting who can actually post (optional, recommended)

Right now, **any signed-in Identity user** can publish updates — signing up
alone is enough. If you want to limit posting to specific officers even
after opening registration to more people, you can add a role check:

1. In Netlify: Identity → your user → *Edit → Roles* → add a role, e.g. `admin`.
2. In `netlify/functions/updates-create.js` (and `updates-delete.js`), tighten
   the auth check from "any signed-in user" to "user has the admin role":

   ```js
   const user = context.clientContext && context.clientContext.user;
   const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
   if (!user || !roles.includes('admin')) {
     return { statusCode: 401, body: JSON.stringify({ error: 'Not authorized.' }) };
   }
   ```

## Notes & limits

- **Banner images** are stored as base64 inside the update record itself
  (simplest option, no separate file upload step). Keep them under ~1.5MB —
  the functions will reject anything larger with a clear error message. For
  a lot of large images long-term, consider moving to Netlify's
  [Image CDN](https://docs.netlify.com/build/image-cdn/overview/) or an
  external storage bucket instead.
- **Local testing:** install the [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
  and run `netlify dev` from this folder — it emulates Identity, Functions,
  and Blobs locally so you can test before deploying.
- The static update cards already in `index.html` (the ones about the
  portal launch, the blockchain event, etc.) are just placeholder/seed
  content — they stay visible underneath anything real officers publish, so
  the page never looks empty. Feel free to delete them once you have real
  posts, or leave them as-is.
