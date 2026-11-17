import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { ZipArchive, type ArchiverError } from "archiver";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveVideo } from "@/lib/resolve";
import { ExtractError } from "@/lib/types";
import { safeName } from "@/lib/extractors/common";
import type { Source } from "@/lib/extractors/common";
import { ffmpegPath } from "@/lib/ffmpeg";
import { isAllowedImageHost } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK = 256 * 1024;
const MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

function disposition(name: string, ext: string) {
  const file = `${name}.${ext}`;
  const ascii = file.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`;
}

function errorResponse(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function allowedImageUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && isAllowedImageHost(url.hostname);
  } catch {
    return false;
  }
}

async function fetchDirectSource(
  src: Extract<Source, { type: "direct" }>,
  signal: AbortSignal,
  requireImage = false,
): Promise<Response> {
  let lastStatus = 0;
  for (const url of [src.url, ...(src.fallbackUrls ?? [])]) {
    if (requireImage && !allowedImageUrl(url)) continue;
    try {
      const response = await fetch(url, {
        headers: src.headers,
        redirect: "follow",
        signal,
      });
      if (
        response.ok &&
        response.body &&
        (!requireImage || response.headers.get("content-type")?.startsWith("image/"))
      ) {
        return response;
      }
      lastStatus = response.status || 502;
      await response.body?.cancel();
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  if (lastStatus) throw new Error(`The source server refused the download (HTTP ${lastStatus}).`);
  throw new Error(requireImage ? "No valid photo source could be downloaded." : "No valid media source could be downloaded.");
}

/** Download a (googlevideo) URL to disk in ranged chunks, which avoids throttling / 403s. */
async function downloadToFile(
  url: string,
  file: string,
  size: number | undefined,
  headers: Record<string, string>,
  signal: AbortSignal,
  cpn: string,
) {
  const out = createWriteStream(file);
  try {
    if (!size) {
      const sourceUrl = new URL(url);
      sourceUrl.searchParams.set("cpn", cpn);
      const r = await fetch(sourceUrl, { headers, signal });
      if (!r.ok || !r.body) throw new Error(`Video source refused the download (HTTP ${r.status}).`);
      await pipeline(Readable.fromWeb(r.body as never), out);
      return;
    }
    for (let start = 0; start < size; start += CHUNK) {
      const end = Math.min(start + CHUNK, size) - 1;
      const chunkUrl = new URL(url);
      chunkUrl.searchParams.set("range", `${start}-${end}`);
      chunkUrl.searchParams.set("cpn", cpn);
      const r = await fetch(chunkUrl, { headers, signal });
      if (!r.ok || !r.body) {
        throw new Error(`Video source refused bytes ${start}-${end} (HTTP ${r.status}).`);
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (!out.write(buf)) await new Promise<void>((res) => out.once("drain", () => res()));
    }
    await new Promise<void>((res, rej) => {
      out.end(() => res());
      out.once("error", rej);
    });
  } catch (e) {
    out.destroy();
    throw e;
  }
}

function runFfmpeg(args: string[], signal: AbortSignal): Promise<void> {
  const bin = ffmpegPath();
  if (!bin) return Promise.reject(new Error("ffmpeg not available"));
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err}`))));
    signal.addEventListener("abort", () => p.kill("SIGKILL"), { once: true });
  });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const input = sp.get("url") ?? "";
  const formatId = sp.get("format") ?? "";

  try {
    const { info, sources } = await resolveVideo(input, { fresh: true });
    const name = safeName(info.title);
    if (sp.get("bulk") === "1") {
      const images = info.formats.filter((format) => format.kind === "image");
      if (!images.length) return errorResponse("This post does not contain downloadable photos.", 400);
      if (images.length > 100) return errorResponse("This post has too many photos to archive.", 413);

      const archive = new ZipArchive({ store: true });
      const output = new PassThrough();
      archive.on("error", (error: ArchiverError) => {
        console.error("[photo archive]", error);
        output.destroy(error);
      });
      archive.pipe(output);
      void (async () => {
        try {
          for (const [index, format] of images.entries()) {
            const src = sources[format.id];
            if (!src || src.type !== "direct") {
              throw new ExtractError("A photo source is invalid or unavailable.");
            }
            const upstream = await fetchDirectSource(src, req.signal, true);
            archive.append(Readable.fromWeb(upstream.body as never), {
              name: `photo-${String(index + 1).padStart(2, "0")}.${format.ext}`,
            });
          }
          await archive.finalize();
        } catch (error) {
          archive.abort();
          console.error("[photo archive]", error);
          output.destroy(error instanceof Error ? error : new Error("Photo archive failed."));
        }
      })();
      return new Response(Readable.toWeb(output) as ReadableStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": disposition(`${name}-photos`, "zip"),
          "Cache-Control": "no-store",
        },
      });
    }

    const src = sources[formatId];
    if (!src) return errorResponse("Unknown quality. Please detect the video again.", 400);

    if (src.type === "direct") {
      const format = info.formats.find((item) => item.id === formatId);
      if (format?.kind === "image" && !allowedImageUrl(src.url)) {
        if (!(src.fallbackUrls ?? []).some(allowedImageUrl)) {
          return errorResponse("The photo source is invalid.", 400);
        }
      }
      const up = await fetchDirectSource(src, req.signal, format?.kind === "image");
      const headers: Record<string, string> = {
        "Content-Type": MIME[src.ext] ?? "application/octet-stream",
        "Content-Disposition": disposition(
          format?.kind === "image" ? `${name}-${safeName(format.label)}` : name,
          src.ext,
        ),
        "Cache-Control": "no-store",
      };
      const len = up.headers.get("content-length");
      if (len) headers["Content-Length"] = len;
      return new Response(up.body, { headers });
    }

    // merge: video-only + audio-only -> mp4 (stream copy, no re-encode)
    const dir = await mkdtemp(path.join(tmpdir(), "alldl-"));
    const cleanup = () => void rm(dir, { recursive: true, force: true }).catch(() => {});
    try {
      const vFile = path.join(dir, "v.mp4");
      const aFile = path.join(dir, "a.m4a");
      const oFile = path.join(dir, "out.mp4");
      const h = src.headers ?? {};
      const cpn = randomBytes(8).toString("hex");
      await Promise.all([
        downloadToFile(src.videoUrl, vFile, src.videoSize, h, req.signal, cpn),
        downloadToFile(src.audioUrl, aFile, src.audioSize, h, req.signal, cpn),
      ]);
      await runFfmpeg(
        ["-y", "-i", vFile, "-i", aFile, "-c", "copy", "-movflags", "+faststart", oFile],
        req.signal,
      );
      const { size } = await stat(oFile);
      const rs = createReadStream(oFile);
      rs.on("close", cleanup);
      return new Response(Readable.toWeb(rs) as ReadableStream, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(size),
          "Content-Disposition": disposition(name, "mp4"),
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      cleanup();
      throw e;
    }
  } catch (e) {
    if (e instanceof ExtractError) return errorResponse(e.message, e.status);
    console.error("[download]", e);
    return errorResponse(
      e instanceof Error && /HTTP \d{3}/.test(e.message)
        ? e.message
        : "The source could not be downloaded. It may be private, expired, or blocked by the platform. Try detecting the link again.",
      502,
    );
  }
}
