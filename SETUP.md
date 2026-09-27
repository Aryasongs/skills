# Nexor Skill — profile-share fix + new features: setup

## 1. Files to deploy
Push both to your GitHub repo (same one connected to Cloudflare Pages):
- `index.html` (replaces your current one)
- `functions/dev/[[path]].js` (new — Cloudflare Pages auto-detects anything under `/functions`, no config needed)

Cloudflare Pages will pick up the Function automatically on the next deploy since it already builds from this repo.

## 2. Firebase Realtime Database rules — add a `publicProfiles` node
The white-screen/no-meta-data bug had two causes:
1. No code anywhere parsed the `/dev/:handle` URL, so opening a share link did nothing.
2. Crawlers (WhatsApp, LinkedIn, etc.) don't run JS, so they always saw the same generic tags.

Both are fixed now, but they read a **new, safe public mirror** at `publicProfiles/{uid}` (name, badges, certs, points — no email) instead of the private `users/{uid}` tree. Add this to your Firebase rules (merge with whatever else you already have — don't replace the whole file blindly):

```json
{
  "rules": {
    "publicProfiles": {
      ".read": true,
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

`handleIndex` must already be publicly readable (your login flow depends on it), so no change needed there.

## 3. Add a default share image
`og-default.png` (1200×630px) is referenced as the fallback preview image — drop one at the repo root, or change the path in `index.html`'s `<meta id="ogImage">`/`<meta id="twImage">` tags and in `functions/dev/[[path]].js`.

## 4. What changed
- **Profile sharing**: `/dev/:handle` now actually renders a read-only public profile (or a clear "private/doesn't exist" message instead of a blank screen), and the Cloudflare Function gives each shared link its own title/description/image for previews.
- **SEO**: proper `<meta description>`, Open Graph, Twitter Card, canonical link, and JSON-LD on the base page; title/description update per view (library, commons, public profile).
- **Leaderboard**: Commons tab now ranks public profiles by points (`publicProfiles` ordered by `points`).
- **Recommended for you**: rule-based "continue this course / finish this path" block on the Library page, based on the signed-in learner's own progress.
- **Add to LinkedIn**: every badge/certification card now has an "Add to LinkedIn" button using LinkedIn's official add-to-profile link format, pointing at the public verification URL.

## 5. Known limits (be upfront about these)
- The "AI recommendations" are rule-based (progress → next course/path), not an LLM call — wiring a real model in would need a backend endpoint holding an API key (never put an API key in client-side JS).
- The leaderboard reads the whole `publicProfiles` list client-side; fine for hundreds of users, but if this grows large, move ranking to a scheduled Cloud Function that writes a small precomputed top-N list.
