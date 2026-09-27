// Cloudflare Pages Function
// Route: /dev/*  (matches /dev/handle, /dev/handle/badge/id, /dev/handle/cert/id)
//
// WHY THIS FILE EXISTS:
// Nexor Skill is a static single-page app. Real browsers run its JS and can render
// a public profile fine. But link-preview crawlers (WhatsApp, iMessage, Slack,
// Twitter/X, LinkedIn, Discord, Facebook) do NOT execute JavaScript — they only read
// the <meta> tags already present in the raw HTML response. Without this function,
// every /dev/* link shows the same generic site preview (or a blank one), because
// the raw index.html has no idea which profile the URL is asking for.
//
// This function runs at Cloudflare's edge before the static file is served. It looks
// up the requested profile in Firebase, rewrites the <title>/<meta> tags to match
// that specific person, and then serves the (otherwise unmodified) index.html so the
// SPA boots normally for real visitors while crawlers see a correct preview.

const FIREBASE_DB_URL = "https://pulse2-92372-default-rtdb.firebaseio.com";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // /dev/<handle>[/badge|cert/<id>]
  const parts = url.pathname.replace(/^\/dev\//, "").split("/").filter(Boolean);
  const handle = parts[0];

  // Always serve the real app shell (index.html), regardless of the /dev/* path —
  // there's no physical file at that path, so we fetch index.html explicitly instead
  // of relying on env.ASSETS.fetch(request), which would 404 on an unknown path.
  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/index.html";
  const assetResponse = await env.ASSETS.fetch(new Request(shellUrl, request));
  if (!handle) return assetResponse;

  let profile = null;
  try {
    const handleRes = await fetch(`${FIREBASE_DB_URL}/handleIndex/${encodeURIComponent(handle)}.json`);
    const handleVal = await handleRes.json();
    const uid = typeof handleVal === "string" ? handleVal : handleVal && handleVal.uid;
    if (uid) {
      const profileRes = await fetch(`${FIREBASE_DB_URL}/publicProfiles/${uid}.json`);
      profile = await profileRes.json();
    }
  } catch (e) {
    // Firebase unreachable or malformed data — fall through to default meta below.
    profile = null;
  }

  const canonicalUrl = `https://skills.kashishai.com/dev/${handle}`;
  const title = profile
    ? `${profile.name} — Nexor Skill developer profile`
    : `Profile | Nexor Skill`;
  const description = profile
    ? `${profile.name} has earned ${(profile.certs || []).length} certification(s) and ` +
      `${(profile.badges || []).length} badge(s) on Nexor Skill.` +
      (profile.points ? ` ${profile.points} points.` : "")
    : `This Nexor Skill developer profile is private or doesn't exist.`;
  const image = profile && profile.profileImage
    ? profile.profileImage
    : "https://skills.kashishai.com/og-default.png";

  class MetaRewriter {
    element(el) {
      const attr = el.getAttribute("property") || el.getAttribute("name") || el.tagName;
      if (el.tagName === "title") { /* handled by TitleRewriter */ }
      if (attr === "og:title" || attr === "twitter:title") el.setAttribute("content", title);
      if (attr === "og:description" || attr === "description" || attr === "twitter:description") el.setAttribute("content", description);
      if (attr === "og:url") el.setAttribute("content", canonicalUrl);
      if (attr === "og:image" || attr === "twitter:image") el.setAttribute("content", image);
      if (el.tagName === "link" && el.getAttribute("rel") === "canonical") el.setAttribute("href", canonicalUrl);
    }
  }
  class TitleRewriter {
    element(el) { el.setInnerContent(title); }
  }

  return new HTMLRewriter()
    .on('meta[property="og:title"]', new MetaRewriter())
    .on('meta[property="og:description"]', new MetaRewriter())
    .on('meta[name="description"]', new MetaRewriter())
    .on('meta[property="og:url"]', new MetaRewriter())
    .on('meta[property="og:image"]', new MetaRewriter())
    .on('meta[name="twitter:title"]', new MetaRewriter())
    .on('meta[name="twitter:description"]', new MetaRewriter())
    .on('meta[name="twitter:image"]', new MetaRewriter())
    .on("link#canonicalLink", new MetaRewriter())
    .on("title", new TitleRewriter())
    .transform(assetResponse);
}
