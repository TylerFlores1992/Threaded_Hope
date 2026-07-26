import "server-only";

/**
 * Latest Instagram posts for the homepage strip.
 *
 * Uses the Instagram Graph API (`graph.instagram.com/me/media`) with a
 * long-lived user access token in `INSTAGRAM_ACCESS_TOKEN`. Fetching the newest
 * N each time means a new post automatically appears and the oldest drops off.
 *
 * Returns `[]` when no token is configured or the request fails, so the caller
 * can fall back gracefully (the site never breaks on a missing/expired token).
 */
export type InstagramPost = {
  id: string;
  imageUrl: string;
  permalink: string;
  caption?: string;
};

export async function getInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return [];

  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption";
  const url = `https://graph.instagram.com/me/media?fields=${fields}&limit=${limit}&access_token=${token}`;

  try {
    // Re-fetch hourly so new posts surface and old ones fall off on their own.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`Instagram fetch failed: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        media_type: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink: string;
        caption?: string;
      }>;
    };
    const posts: InstagramPost[] = [];
    for (const m of data.data ?? []) {
      // Videos expose a still via thumbnail_url; images use media_url.
      const imageUrl = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
      if (!imageUrl) continue;
      posts.push({
        id: m.id,
        imageUrl,
        permalink: m.permalink,
        caption: m.caption,
      });
    }
    return posts.slice(0, limit);
  } catch (err) {
    console.error("Instagram fetch error:", err);
    return [];
  }
}
