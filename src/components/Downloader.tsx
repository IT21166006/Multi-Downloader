"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPlatform, extractUrl } from "@/lib/platforms";
import type { VideoFormat, VideoInfo } from "@/lib/types";
import { PLATFORM_META, PlatformLogo } from "./Logos";

type Phase = "idle" | "detecting" | "ready" | "error";
type DlState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "downloading"; loaded: number; total: number }
  | { status: "done" }
  | { status: "error"; message: string };

function fmtSize(n?: number) {
  if (!n) return "";
  if (n > 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
function fmtDur(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function thumbSrc(u?: string) {
  return u ? `/api/thumb?u=${encodeURIComponent(u)}` : undefined;
}

export default function Downloader() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [dl, setDl] = useState<DlState>({ status: "idle" });
  const liveUrl = extractUrl(input);
  const livePlatform = liveUrl ? detectPlatform(liveUrl) : null;
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  const detect = useCallback(async (text: string) => {
    const url = extractUrl(text);
    if (!url) {
      setPhase("error");
      setError("Please paste a valid video link (https://…).");
      return;
    }
    if (!detectPlatform(url)) {
      setPhase("error");
      setError("Unsupported link. Paste a TikTok, RedNote (Xiaohongshu), Facebook or YouTube video link.");
      return;
    }
    const id = ++reqId.current;
    setPhase("detecting");
    setError("");
    setVideo(null);
    setDl({ status: "idle" });
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (id !== reqId.current) return;
      if (!data.ok) throw new Error(data.error || "Could not detect a video.");
      const v = data.video as VideoInfo;
      setVideo(v);
      setVideoUrl(url);
      setSelected(v.formats.find((f) => f.kind === "video")?.id ?? v.formats[0]?.id ?? "");
      setPhase("ready");
    } catch (e) {
      if (id !== reqId.current) return;
      setPhase("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  // Auto-detect shortly after a recognised link appears in the box.
  useEffect(() => {
    const url = extractUrl(input);
    if (!url || !detectPlatform(url) || url === videoUrl) return;
    const t = setTimeout(() => detect(input), 450);
    return () => clearTimeout(t);
  }, [input, videoUrl, detect]);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text);
    } catch {
      setError("Clipboard access was blocked — press Ctrl/⌘+V in the box instead.");
      setPhase("error");
    }
  }

  function reset() {
    reqId.current++;
    abortRef.current?.abort();
    setInput("");
    setVideo(null);
    setVideoUrl("");
    setPhase("idle");
    setError("");
    setDl({ status: "idle" });
  }

  async function download(bulk = false) {
    if (!video || (!bulk && !selected)) return;
    const fmt = video.formats.find((f) => f.id === selected);
    if (!bulk && !fmt) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDl({ status: "preparing" });
    try {
      const res = await fetch(
        `/api/download?url=${encodeURIComponent(videoUrl)}&format=${encodeURIComponent(selected)}${bulk ? "&bulk=1" : ""}`,
        { signal: ctrl.signal },
      );
      if (!res.ok || !res.body) {
        throw new Error((await res.text().catch(() => "")) || "Download failed.");
      }
      const total = Number(res.headers.get("content-length")) || fmt?.size || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array<ArrayBuffer>);
        loaded += value.length;
        setDl({ status: "downloading", loaded, total });
      }
      const blob = new Blob(chunks, { type: res.headers.get("content-type") ?? "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = bulk
        ? `${safeFile(video.title)}-photos.zip`
        : `${safeFile(video.title)}${fmt?.kind === "video" ? ` (${fmt.label})` : fmt?.kind === "image" ? ` (${fmt.label})` : ""}.${fmt?.ext ?? "mp4"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setDl({ status: "done" });
    } catch (e) {
      if (ctrl.signal.aborted) {
        setDl({ status: "idle" });
        return;
      }
      setDl({ status: "error", message: e instanceof Error ? e.message : "Download failed." });
    }
  }

  const videos = video?.formats.filter((f) => f.kind === "video") ?? [];
  const audios = video?.formats.filter((f) => f.kind === "audio") ?? [];
  const images = video?.formats.filter((f) => f.kind === "image") ?? [];
  const busy = dl.status === "preparing" || dl.status === "downloading";
  const selFmt = video?.formats.find((f) => f.id === selected);

  return (
    <div className="w-full">
      {/* Input */}
      <div className="rounded-2xl bg-white p-2 shadow-xl shadow-blue-950/20 ring-1 ring-white/10">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              {livePlatform ? (
                <PlatformLogo platform={livePlatform} size={26} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
                  <path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.5-1.5" />
                </svg>
              )}
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && detect(input)}
              placeholder="Paste a TikTok, RedNote, Facebook or YouTube link…"
              className="h-14 w-full rounded-xl border-0 bg-slate-50 pl-14 pr-24 text-base text-slate-900 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
              autoComplete="off"
              aria-label="Video link"
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              {input ? (
                <button onClick={reset} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800" type="button">
                  Clear
                </button>
              ) : (
                <button onClick={paste} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" type="button">
                  Paste
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => detect(input)}
            disabled={!input.trim() || phase === "detecting"}
            className="h-14 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-8 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {phase === "detecting" ? "Detecting…" : "Detect media"}
          </button>
        </div>
      </div>

      {/* Detecting */}
      {phase === "detecting" && (
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg" role="status">
          <Spinner />
          <div>
            <p className="font-semibold text-slate-900">Looking for media…</p>
            <p className="text-sm text-slate-500">Reading the link and collecting available videos or photos.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <svg className="mt-0.5 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-sm leading-relaxed">{error}</p>
        </div>
      )}

      {/* Result */}
      {phase === "ready" && video && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-xl shadow-blue-950/20">
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {images.length && !videos.length ? "Photo post detected" : "Content detected"}
          </div>

          <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[220px_1fr]">
            {/* Preview */}
            <div>
              <div className="relative mx-auto aspect-[9/16] max-h-[340px] w-full max-w-[200px] overflow-hidden rounded-xl bg-slate-900 md:max-w-none">
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbSrc(video.thumbnail)} alt="" className="h-full w-full object-cover" />
                ) : null}
                {video.duration ? (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 text-xs font-semibold text-white">
                    {fmtDur(video.duration)}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Details + quality */}
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <PlatformLogo platform={video.platform} size={22} />
                <span className="text-sm font-semibold" style={{ color: PLATFORM_META[video.platform].color }}>
                  {PLATFORM_META[video.platform].name}
                </span>
              </div>
              <h2 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900">{video.title}</h2>
              {video.author && <p className="mt-0.5 text-sm text-slate-500">by {video.author}</p>}

              {videos.length > 0 && (
                <p className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Choose video quality
                </p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {videos.map((f) => (
                  <QualityOption key={f.id} f={f} active={selected === f.id} onSelect={() => setSelected(f.id)} disabled={busy} />
                ))}
              </div>

              {audios.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">Audio only</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {audios.map((f) => (
                      <QualityOption key={f.id} f={f} active={selected === f.id} onSelect={() => setSelected(f.id)} disabled={busy} />
                    ))}
                  </div>
                </>
              )}

              {images.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Photos ({images.length})
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {images.map((f) => (
                      <QualityOption key={f.id} f={f} active={selected === f.id} onSelect={() => setSelected(f.id)} disabled={busy} />
                    ))}
                  </div>
                  <button
                    onClick={() => download(true)}
                    disabled={busy}
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                  >
                    <DownloadIcon />
                    Download all {images.length} photos (.zip)
                  </button>
                </>
              )}

              <button
                onClick={() => download()}
                disabled={busy || !selFmt}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {busy ? (
                  <>
                    <Spinner light /> {dl.status === "preparing" ? "Preparing your file…" : "Downloading…"}
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    Download {selFmt ? (selFmt.kind === "audio" ? selFmt.label : `${selFmt.label} ${selFmt.ext.toUpperCase()}`) : ""}
                  </>
                )}
              </button>

              {dl.status === "downloading" && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all"
                      style={{ width: dl.total ? `${Math.min(100, (dl.loaded / dl.total) * 100)}%` : "40%" }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {fmtSize(dl.loaded)}
                    {dl.total ? ` / ${fmtSize(dl.total)}` : ""}
                  </p>
                </div>
              )}
              {dl.status === "preparing" && selFmt && selFmt.kind === "video" && video.platform === "youtube" && (
                <p className="mt-3 text-xs text-slate-500">
                  Merging video &amp; audio in HD — this can take a few seconds…
                </p>
              )}
              {dl.status === "done" && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Saved! Check your Downloads folder.
                </p>
              )}
              {dl.status === "error" && (
                <p className="mt-3 text-sm text-red-600" role="alert">{dl.message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function safeFile(s: string) {
  return (s.replace(/[\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)) || "video";
}

function QualityOption({
  f,
  active,
  onSelect,
  disabled,
}: {
  f: VideoFormat;
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition disabled:opacity-60 ${
        active ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? "border-blue-600 bg-blue-600" : "border-slate-300"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-base font-bold text-slate-900">{f.label}</span>
          <span className="text-xs font-semibold uppercase text-slate-400">{f.ext}</span>
        </span>
        {f.note && <span className="block truncate text-xs text-slate-500">{f.note}</span>}
      </span>
      {f.size ? <span className="shrink-0 text-xs font-semibold text-slate-500">{fmtSize(f.size)}</span> : null}
    </button>
  );
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-t-transparent ${
        light ? "border-white" : "border-blue-600"
      }`}
    />
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
