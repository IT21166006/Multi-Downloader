import { ExtractError, type VideoFormat } from "../types";
import { DESKTOP_UA, fetchWithTimeout, type Resolved, type Source } from "./common";

const HEADERS = { "User-Agent": DESKTOP_UA, Referer: "https://www.facebook.com/" };

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#x3d;/gi, "=");
}

function metaContent(html: string, key: string): string | undefined {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const keyMatch = tag.match(/\b(?:property|name)=["']([^"']+)["']/i);
    if (keyMatch?.[1]?.toLowerCase() !== key) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content) return decodeHtml(content);
  }
  return undefined;
}

function decodeJsonString(value: string): string | null {
  try {
    return decodeHtml(JSON.parse(`"${value}"`) as string);
  } catch {
    return null;
  }
}

function isFacebookMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      ["fbcdn.net", "fbsbx.com"].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

function addCandidate(
  candidates: Map<string, string>,
  quality: string,
  rawUrl: string | undefined,
) {
  if (!rawUrl || !isFacebookMediaUrl(rawUrl)) return;
  if (!candidates.has(quality)) candidates.set(quality, rawUrl);
}

export async function resolveFacebook(rawUrl: string): Promise<Resolved> {
  let html: string;
  try {
    const response = await fetchWithTimeout(rawUrl, {
      headers: { ...HEADERS, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      timeoutMs: 25000,
    });
    if (!response.ok) throw new ExtractError(`Facebook could not open this link (${response.status}).`);
    html = await response.text();
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError("Could not read this Facebook video. Make sure the post is public and try again.");
  }

  const candidates = new Map<string, string>();
  const fields = [
    ["HD", "playable_url_quality_hd"],
    ["HD", "browser_native_hd_url"],
    ["SD", "playable_url"],
    ["SD", "browser_native_sd_url"],
  ] as const;
  for (const [label, field] of fields) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`"${escaped}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g");
    for (const match of html.matchAll(pattern)) {
      addCandidate(candidates, label, decodeJsonString(match[1]) ?? undefined);
    }
  }
  for (const property of ["og:video", "og:video:url", "og:video:secure_url", "twitter:player:stream"]) {
    addCandidate(candidates, "Default", metaContent(html, property));
  }

  const formats: VideoFormat[] = [];
  const sources: Record<string, Source> = {};
  for (const [label, url] of candidates) {
    const id = label.toLowerCase();
    if (sources[id]) continue;
    formats.push({
      id,
      label,
      note: label === "HD" ? "High definition" : undefined,
      ext: "mp4",
      kind: "video",
    });
    sources[id] = { type: "direct", url, headers: HEADERS, ext: "mp4" };
  }

  if (!formats.length) {
    throw new ExtractError("No downloadable video found. The Facebook post must be public and contain a video.");
  }

  return {
    info: {
      platform: "facebook",
      title: metaContent(html, "og:title") || "Facebook video",
      thumbnail: metaContent(html, "og:image"),
      formats,
    },
    sources,
  };
}
