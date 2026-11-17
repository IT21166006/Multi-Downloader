import { ExtractError, type Platform } from "./types";
import { detectPlatform, extractUrl } from "./platforms";
import type { Resolved } from "./extractors/common";
import { resolveTikTok } from "./extractors/tiktok";
import { resolveRedNote } from "./extractors/rednote";
import { resolveFacebook } from "./extractors/facebook";
import { resolveYouTube } from "./extractors/youtube";

const TTL = 30 * 1000;
const cache = new Map<string, { at: number; value: Resolved }>();
const inflight = new Map<string, Promise<Resolved>>();

export function normalizeInput(input: string): { url: string; platform: Platform } {
  const url = extractUrl(input ?? "");
  if (!url) throw new ExtractError("Please paste a valid video link.", 400);
  const platform = detectPlatform(url);
  if (!platform) {
    throw new ExtractError(
      "Unsupported link. Paste a TikTok, RedNote (Xiaohongshu), Facebook or YouTube video link.",
      400,
    );
  }
  return { url, platform };
}

export async function resolveVideo(input: string, options: { fresh?: boolean } = {}): Promise<Resolved> {
  const { url, platform } = normalizeInput(input);

  const hit = cache.get(url);
  if (!options.fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  const pending = options.fresh ? undefined : inflight.get(url);
  if (pending) return pending;

  const run = (async () => {
    switch (platform) {
      case "tiktok":
        return resolveTikTok(url);
      case "rednote":
        return resolveRedNote(url);
      case "facebook":
        return resolveFacebook(url);
      case "youtube":
        return resolveYouTube(url);
    }
  })();
  if (!options.fresh) inflight.set(url, run);
  try {
    const value = await run;
    cache.set(url, { at: Date.now(), value });
    if (cache.size > 200) {
      for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
    }
    return value;
  } finally {
    if (!options.fresh) inflight.delete(url);
  }
}
