import { ExtractError, type VideoFormat } from "../types";
import { DESKTOP_UA, fetchWithTimeout, https, imageExtension, type Resolved, type Source } from "./common";

const HEADERS = { "User-Agent": DESKTOP_UA, Referer: "https://www.xiaohongshu.com/" };

interface Stream {
  masterUrl?: string;
  backupUrls?: string[];
  width?: number;
  height?: number;
  videoBitrate?: number;
  size?: number;
  qualityType?: string;
}
interface Note {
  title?: string;
  desc?: string;
  user?: { nickname?: string };
  imageList?: {
    urlDefault?: string;
    url?: string;
    urlPre?: string;
    infoList?: { url?: string }[];
  }[];
  video?: {
    capa?: { duration?: number };
    media?: {
      video?: { duration?: number };
      stream?: Record<string, Stream[] | undefined>;
    };
    consumer?: { originVideoKey?: string };
  };
}

function findNote(state: unknown, id: string | null): Note | null {
  const s = state as {
    note?: { noteDetailMap?: Record<string, { note?: Note }> };
    noteData?: { data?: { noteData?: Note } };
  };
  const map = s?.note?.noteDetailMap;
  if (map) {
    if (id && map[id]?.note) return map[id].note!;
    for (const v of Object.values(map)) if (v?.note?.video) return v.note;
    for (const v of Object.values(map)) if (v?.note) return v.note;
  }
  return s?.noteData?.data?.noteData ?? null;
}

function parseState(html: string): unknown {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/);
  if (!m) return null;
  const json = m[1].trim().replace(/;$/, "").replace(/\bundefined\b/g, "null");
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  return html.match(re)?.[1]?.replace(/&amp;/g, "&");
}

export async function resolveRedNote(url: string): Promise<Resolved> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8" },
    redirect: "follow",
    timeoutMs: 25000,
  });
  if (!res.ok) {
    throw new ExtractError(`RedNote could not open this link (HTTP ${res.status}).`, 502);
  }
  const html = await res.text();
  const finalUrl = res.url;
  if (/\/login\b/i.test(new URL(finalUrl).pathname)) {
    throw new ExtractError(
      "RedNote redirected this post to its login page. Downloading requires a publicly accessible post; no database setup is needed.",
      403,
    );
  }
  if (/\/404\b/.test(finalUrl) || /error_code=/.test(finalUrl)) {
    throw new ExtractError(
      "RedNote could not open this note. Copy the full link from the Share button (it must include the security token) and try again.",
    );
  }
  const idMatch = finalUrl.match(/\/(?:explore|discovery\/item|red_video|item)\/([0-9a-f]{16,})/i);
  const noteId = idMatch ? idMatch[1] : null;

  const note = findNote(parseState(html), noteId);
  const formats: VideoFormat[] = [];
  const sources: Record<string, Source> = {};

  for (const [index, image] of (note?.video ? [] : note?.imageList ?? []).entries()) {
    const candidates = [
      image.urlDefault,
      image.url,
      image.urlPre,
      ...(image.infoList ?? []).map((item) => item.url),
    ].map(https).filter((candidate): candidate is string => Boolean(candidate));
    const imageUrl = candidates[0];
    if (!imageUrl) continue;
    const id = `image-${index + 1}`;
    const ext = imageExtension(imageUrl);
    formats.push({ id, label: `Photo ${index + 1}`, ext, kind: "image" });
    sources[id] = {
      type: "direct",
      url: imageUrl,
      fallbackUrls: candidates.slice(1),
      headers: HEADERS,
      ext,
    };
  }

  if (note?.video) {
    const streams = note.video.media?.stream ?? {};
    const byHeight = new Map<number, Stream>();
    // Prefer h264 (plays everywhere), fall back to other codecs for missing heights.
    for (const codec of ["h264", "h265", "av1", "h266"]) {
      for (const st of streams[codec] ?? []) {
        if (!st.masterUrl) continue;
        const h = Math.min(st.width || 0, st.height || 0) || st.height || 0;
        const prev = byHeight.get(h);
        if (!prev) byHeight.set(h, st);
      }
    }
    const origKey = note.video.consumer?.originVideoKey;
    if (origKey) {
      formats.push({
        id: "original",
        label: "Original",
        note: "Source file · No watermark",
        height: 99999,
        ext: "mp4",
        kind: "video",
      });
      sources.original = {
        type: "direct",
        url: `https://sns-video-bd.xhscdn.com/${origKey}`,
        headers: HEADERS,
        ext: "mp4",
      };
    }
    [...byHeight.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([h, st]) => {
        const id = `h${h || "x"}`;
        formats.push({
          id,
          label: h ? `${h}p` : "Video",
          note: "No watermark",
          height: h || undefined,
          ext: "mp4",
          kind: "video",
          size: st.size || undefined,
        });
        sources[id] = {
          type: "direct",
          url: https(st.masterUrl)!,
          fallbackUrls: (st.backupUrls ?? [])
            .map((backup) => https(backup))
            .filter((backup): backup is string => Boolean(backup)),
          headers: HEADERS,
          ext: "mp4",
        };
      });
  }

  // Fallback: og:video meta tag
  if (!formats.length) {
    const ogVideo = meta(html, "og:video");
    if (ogVideo) {
      formats.push({ id: "default", label: "Default", note: "No watermark", ext: "mp4", kind: "video" });
      sources.default = { type: "direct", url: https(ogVideo)!, headers: HEADERS, ext: "mp4" };
    }
  }

  if (!formats.length) {
    throw new ExtractError(
      "No video or photos found in this RedNote link. Make sure the post is public.",
    );
  }

  const title =
    note?.title || note?.desc || meta(html, "og:title") || (note?.video ? "RedNote video" : "RedNote photo post");
  const thumb =
    note?.imageList?.[0]?.urlDefault || note?.imageList?.[0]?.url || meta(html, "og:image");
  const dur = note?.video?.capa?.duration ?? note?.video?.media?.video?.duration;

  return {
    info: {
      platform: "rednote",
      title,
      author: note?.user?.nickname,
      thumbnail: https(thumb),
      duration: dur ? (dur > 1000 ? Math.round(dur / 1000) : dur) : undefined,
      formats,
    },
    sources,
  };
}
