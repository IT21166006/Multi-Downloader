import { NextResponse } from "next/server";
import { resolveVideo } from "@/lib/resolve";
import { ExtractError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const { info } = await resolveVideo(body.url ?? "");
    return NextResponse.json({ ok: true, video: info });
  } catch (e) {
    const status = e instanceof ExtractError ? e.status : 500;
    const message =
      e instanceof ExtractError
        ? e.message
        : "Something went wrong while reading this link. Please try again.";
    if (!(e instanceof ExtractError)) console.error("[detect]", e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
