import { existsSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

let cached: string | null | undefined;

/** Resolve the bundled ffmpeg binary (ffmpeg-static) or a system ffmpeg. */
export function ffmpegPath(): string | null {
  if (cached !== undefined) return cached;
  if (ffmpegStatic && existsSync(ffmpegStatic)) {
    cached = ffmpegStatic;
    return cached;
  }
  const fallback = process.env.FFMPEG_PATH;
  cached = fallback && existsSync(fallback) ? fallback : null;
  return cached;
}

export function ffmpegAvailable(): boolean {
  return ffmpegPath() !== null;
}
