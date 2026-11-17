import { ExtractError, type VideoFormat } from "../types";
import { DESKTOP_UA, fetchWithTimeout, https, imageExtension, type Resolved, type Source } from "./common";

const HEADERS = { "User-Agent": DESKTOP_UA, Referer: "https://www.tiktok.com/" };

interface TikwmData {
  title?: string;
  cover?: string;
  origin_cover?: string;
  duration?: number;
  play?: string;
  hdplay?: string;
  size?: number;
  hd_size?: number;
  music?: string;
  images?: string[];
  author?: { nickname?: string; unique_id?: string };
}

async function viaTikwm(url: string): Promise<Resolved> {
  let lastMsg = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithTimeout(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
      { headers: { "User-Agent": DESKTOP_UA }, timeoutMs: 20000 },
    );
    const json = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: TikwmData;
    } | null;
    if (json?.code === 0 && json.data) {
      const d = json.data;
      const formats: VideoFormat[] = [];
      const sources: Record<string, Source> = {};
      for (const [index, rawUrl] of (d.images ?? []).entries()) {
        const imageUrl = https(rawUrl);
        if (!imageUrl) continue;
        const id = `image-${index + 1}`;
        formats.push({ id, label: `Photo ${index + 1}`, ext: imageExtension(imageUrl), kind: "image" });
        sources[id] = { type: "direct", url: imageUrl, headers: HEADERS, ext: imageExtension(imageUrl) };
      }
      if (!d.play && !d.hdplay && !formats.length) {
        throw new ExtractError("No video or photos found in this TikTok post.");
      }
      if (d.hdplay) {
        formats.push({
          id: "hd",
          label: "HD",
          note: "Best quality · No watermark",
          height: 1080,
          ext: "mp4",
          kind: "video",
          size: d.hd_size || undefined,
        });
        sources.hd = { type: "direct", url: https(d.hdplay)!, headers: HEADERS, ext: "mp4" };
      }
      if (d.play) {
        formats.push({
          id: "sd",
          label: "SD",
          note: "Standard · No watermark",
          height: 720,
          ext: "mp4",
          kind: "video",
          size: d.size || undefined,
        });
        sources.sd = { type: "direct", url: https(d.play)!, headers: HEADERS, ext: "mp4" };
      }
      if (d.music) {
        formats.push({
          id: "audio",
          label: "MP3",
          note: "Original sound",
          ext: "mp3",
          kind: "audio",
        });
        sources.audio = { type: "direct", url: https(d.music)!, headers: HEADERS, ext: "mp3" };
      }
      return {
        info: {
          platform: "tiktok",
          title: d.title || (formats.some((format) => format.kind === "image") ? "TikTok photo post" : "TikTok video"),
          author: d.author?.nickname || d.author?.unique_id,
          thumbnail: https(d.cover || d.origin_cover),
          duration: d.duration,
          formats,
        },
        sources,
      };
    }
    lastMsg = json?.msg || `HTTP ${res.status}`;
    // tikwm free tier is rate limited (1 req/sec) – wait and retry
    if (/limit/i.test(lastMsg)) {
      await new Promise((r) => setTimeout(r, 1300));
      continue;
    }
    break;
  }
  throw new ExtractError(lastMsg || "TikTok lookup failed");
}

interface TikTokPlayAddr {
  UrlList?: string[];
  DataSize?: string | number;
  Width?: number;
  Height?: number;
}
interface TikTokItem {
  desc?: string;
  author?: { nickname?: string; uniqueId?: string };
  video?: {
    cover?: string;
    duration?: number;
    playAddr?: string;
    downloadAddr?: string;
    bitrateInfo?: { GearName?: string; PlayAddr?: TikTokPlayAddr }[];
  };
  imagePost?: {
    images?: {
      displayImage?: { urlList?: string[] };
      imageURL?: { urlList?: string[] };
    }[];
  };
}

/** Fallback: read TikTok's own page data (playAddr is the non-watermarked stream). */
async function viaPage(url: string): Promise<Resolved> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
    timeoutMs: 20000,
  });
  const html = await res.text();
  const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const m = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new ExtractError("Could not read this TikTok page.");
  const data = JSON.parse(m[1]);
  const item: TikTokItem | undefined =
    data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!item || (!item.video && !item.imagePost?.images?.length)) {
    throw new ExtractError("TikTok post not found. Is the link public?");
  }

  const headers = { ...HEADERS, ...(cookies ? { Cookie: cookies } : {}) };
  const formats: VideoFormat[] = [];
  const sources: Record<string, Source> = {};
  const imageUrls = (item.imagePost?.images ?? [])
    .map((image) => image.displayImage?.urlList?.[0] ?? image.imageURL?.urlList?.[0])
    .filter((image): image is string => Boolean(image));
  for (const [index, rawUrl] of imageUrls.entries()) {
    const imageUrl = https(rawUrl);
    if (!imageUrl) continue;
    const id = `image-${index + 1}`;
    const ext = imageExtension(imageUrl);
    formats.push({ id, label: `Photo ${index + 1}`, ext, kind: "image" });
    sources[id] = { type: "direct", url: imageUrl, headers, ext };
  }
  const seen = new Set<string>();
  for (const b of item.video?.bitrateInfo ?? []) {
    const u = b.PlayAddr?.UrlList?.[0];
    if (!u) continue;
    const h = Math.min(b.PlayAddr?.Width ?? 0, b.PlayAddr?.Height ?? 0);
    const label = h ? `${h}p` : (b.GearName ?? "Video");
    if (seen.has(label)) continue;
    seen.add(label);
    const id = `q${formats.length}`;
    formats.push({
      id,
      label,
      note: "No watermark",
      height: h || undefined,
      ext: "mp4",
      kind: "video",
      size: Number(b.PlayAddr?.DataSize) || undefined,
    });
    sources[id] = { type: "direct", url: u, headers, ext: "mp4" };
  }
  if (!formats.some((f) => f.kind === "video") && item.video?.playAddr) {
    formats.push({ id: "sd", label: "SD", note: "No watermark", ext: "mp4", kind: "video" });
    sources.sd = { type: "direct", url: item.video.playAddr, headers, ext: "mp4" };
  }
  if (!formats.length) throw new ExtractError("No downloadable video or photos found.");
  return {
    info: {
      platform: "tiktok",
      title: item.desc || (formats.some((format) => format.kind === "image") ? "TikTok photo post" : "TikTok video"),
      author: item.author?.nickname || item.author?.uniqueId,
      thumbnail: item.video?.cover ?? imageUrls[0],
      duration: item.video?.duration,
      formats,
    },
    sources,
  };
}

export async function resolveTikTok(url: string): Promise<Resolved> {
  try {
    return await viaTikwm(url);
  } catch (e) {
    try {
      return await viaPage(url);
    } catch {
      throw e instanceof ExtractError
        ? e
        : new ExtractError("Could not fetch this TikTok video. Check the link and try again.");
    }
  }
}
