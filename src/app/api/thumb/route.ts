import { isAllowedImageHost } from "@/lib/platforms";
import { DESKTOP_UA } from "@/lib/extractors/common";

export const runtime = "nodejs";

/** Proxies thumbnails (some CDNs block hot-linking). Host allow-list prevents SSRF. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u");
  if (!raw) return new Response("Missing u", { status: 400 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !isAllowedImageHost(target.hostname)) {
    return new Response("Host not allowed", { status: 400 });
  }
  try {
    const up = await fetch(target, {
      headers: { "User-Agent": DESKTOP_UA, Referer: "https://www.tiktok.com/" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!up.ok) return new Response("Upstream error", { status: 502 });
    const type = up.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return new Response("Not an image", { status: 400 });
    return new Response(up.body, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
