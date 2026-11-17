import type { Platform } from "./types";

/** Pull the first URL out of whatever the user pasted (share text often has extra words). */
export function extractUrl(input: string): string | null {
  const m = input.match(/https?:\/\/[^\s"'<>]+/i);
  if (!m) return null;
  return m[0].replace(/[),.;!，。]+$/, "");
}

export function detectPlatform(rawUrl: string): Platform | null {
  let host: string;
  let path: string;
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase();
    path = u.pathname;
  } catch {
    return null;
  }
  const is = (d: string) => host === d || host.endsWith("." + d);

  if (is("tiktok.com")) return "tiktok";
  if (is("xiaohongshu.com") || is("xhslink.com") || is("rednote.com")) return "rednote";
  if (is("facebook.com") || is("fb.watch")) return "facebook";
  if (is("youtu.be")) return "youtube";
  if (is("youtube.com") || is("youtube-nocookie.com")) {
    void path;
    return "youtube";
  }
  return null;
}

export function youtubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host === "youtu.be") return u.pathname.split("/")[1] || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Hosts we are willing to proxy thumbnails from. */
export function isAllowedImageHost(host: string): boolean {
  return [
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokv.com",
    "tiktokv.us",
    "tikwm.com",
    "ibyteimg.com",
    "byteimg.com",
    "xhscdn.com",
    "xiaohongshu.com",
    "rednotecdn.com",
    "fbcdn.net",
    "fbsbx.com",
    "ytimg.com",
    "ggpht.com",
    "googleusercontent.com",
  ].some((d) => host === d || host.endsWith("." + d));
}
