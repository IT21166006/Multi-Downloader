import { Innertube, UniversalCache, Log } from "youtubei.js";
import { ExtractError, type VideoFormat } from "../types";
import { youtubeId } from "../platforms";
import { type Resolved, type Source } from "./common";
import { ffmpegAvailable } from "../ffmpeg";

Log.setLevel(Log.Level.NONE);

let ytPromise: Promise<Innertube> | null = null;
function getYT(): Promise<Innertube> {
  if (!ytPromise) {
    ytPromise = Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((e) => {
      ytPromise = null;
      throw e;
    });
  }
  return ytPromise;
}

interface YTFormat {
  itag: number;
  mime_type: string;
  quality_label?: string;
  height?: number;
  bitrate: number;
  content_length?: number;
  has_audio: boolean;
  has_video: boolean;
  url?: string;
  decipher: (player: unknown) => Promise<string>;
}

async function urlOf(f: YTFormat, yt: Innertube): Promise<string | null> {
  try {
    const u = await f.decipher(yt.session.player);
    if (u) return u;
  } catch {
    /* fall through */
  }
  return f.url ?? null;
}

function heightOf(f: YTFormat): number {
  const m = (f.quality_label ?? "").match(/^(\d+)p/);
  if (m) return Number(m[1]);
  return f.height ?? 0;
}

export async function resolveYouTube(rawUrl: string): Promise<Resolved> {
  const id = youtubeId(rawUrl);
  if (!id) throw new ExtractError("That doesn't look like a valid YouTube video or Shorts link.");
  const yt = await getYT();
  const canMerge = ffmpegAvailable();

  const clients = ["IOS", "WEB", "ANDROID", "TV"] as const;
  let lastErr = "";
  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(id, { client });
      const status = info.playability_status?.status;
      if (status && status !== "OK") {
        lastErr = info.playability_status?.reason || status;
        if (status === "LOGIN_REQUIRED" || status === "ERROR" || status === "UNPLAYABLE") continue;
      }
      const sd = info.streaming_data;
      if (!sd) continue;

      const adaptive = (sd.adaptive_formats ?? []) as unknown as YTFormat[];
      const progressive = (sd.formats ?? []) as unknown as YTFormat[];

      // best AAC audio
      const audios = adaptive
        .filter((f) => f.has_audio && !f.has_video && f.mime_type.includes("mp4a"))
        .sort((a, b) => b.bitrate - a.bitrate);
      const audioUrl = audios[0] ? await urlOf(audios[0], yt) : null;

      // best H.264 video per height
      const bestByHeight = new Map<number, YTFormat>();
      for (const f of adaptive) {
        if (!f.has_video || f.has_audio || !f.mime_type.includes("avc1")) continue;
        const h = heightOf(f);
        if (!h) continue;
        const prev = bestByHeight.get(h);
        if (!prev || f.bitrate > prev.bitrate) bestByHeight.set(h, f);
      }

      const formats: VideoFormat[] = [];
      const sources: Record<string, Source> = {};
      const headers = {
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/",
        Accept: "*/*",
        DNT: "?1",
      };

      if (canMerge && audioUrl) {
        for (const [h, f] of [...bestByHeight.entries()].sort((a, b) => b[0] - a[0])) {
          const vUrl = await urlOf(f, yt);
          if (!vUrl) continue;
          const fid = `v${h}`;
          formats.push({
            id: fid,
            label: `${h}p`,
            note: h >= 1080 ? "Full HD · with audio" : h >= 720 ? "HD · with audio" : "with audio",
            height: h,
            ext: "mp4",
            kind: "video",
            size: (f.content_length ?? 0) + (audios[0].content_length ?? 0) || undefined,
          });
          sources[fid] = {
            type: "merge",
            videoUrl: vUrl,
            audioUrl,
            headers,
            videoSize: f.content_length,
            audioSize: audios[0].content_length,
            ext: "mp4",
          };
        }
      }

      // Keep progressive streams as a fallback if a separate audio/video pair cannot be merged.
      for (const f of progressive) {
        if (!f.has_video || !f.has_audio) continue;
        const h = heightOf(f);
        const u = await urlOf(f, yt);
        if (!u) continue;
        const fid = `p${h || f.itag}`;
        formats.push({
          id: fid,
          label: h ? `${h}p` : "Video",
          note: formats.some((x) => x.height === h) ? "Compatible stream · with audio" : "with audio",
          height: h,
          ext: "mp4",
          kind: "video",
          size: f.content_length,
        });
        sources[fid] = { type: "direct", url: u, headers, ext: "mp4" };
      }

      formats.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

      if (audioUrl) {
        formats.push({
          id: "audio",
          label: "M4A",
          note: "Audio only",
          ext: "m4a",
          kind: "audio",
          size: audios[0].content_length,
        });
        sources.audio = { type: "direct", url: audioUrl, headers, ext: "m4a" };
      }

      if (!formats.some((f) => f.kind === "video")) continue;

      const bi = info.basic_info;
      const thumbs = (bi.thumbnail ?? []) as { url: string; width?: number }[];
      const thumb =
        thumbs.slice().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return {
        info: {
          platform: "youtube",
          title: bi.title || "YouTube video",
          author: bi.author,
          thumbnail: thumb,
          duration: bi.duration,
          formats,
        },
        sources,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new ExtractError(
    lastErr
      ? `YouTube video unavailable: ${lastErr}`
      : "Could not get download links for this YouTube video.",
  );
}
