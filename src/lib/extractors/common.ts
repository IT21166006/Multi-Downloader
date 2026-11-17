import type { VideoInfo } from "../types";

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** A concrete way of obtaining the bytes for one format. */
export type Source =
  | {
      type: "direct";
      url: string;
      fallbackUrls?: string[];
      headers?: Record<string, string>;
      ext: string;
    }
  | {
      type: "merge";
      videoUrl: string;
      audioUrl: string;
      headers?: Record<string, string>;
      videoSize?: number;
      audioSize?: number;
      ext: "mp4";
    };

export interface Resolved {
  info: VideoInfo;
  sources: Record<string, Source>;
}

export function https(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  return u.replace(/^http:\/\//i, "https://");
}

export function safeName(s: string): string {
  const cleaned = s
    .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "video";
}

export function imageExtension(rawUrl: string): string {
  try {
    const ext = new URL(rawUrl).pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1]?.toLowerCase();
    return ext === "jpeg" ? "jpg" : ext || "jpg";
  } catch {
    return "jpg";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: rest.signal ?? ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
