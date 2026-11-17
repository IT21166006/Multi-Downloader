export type Platform = "tiktok" | "rednote" | "facebook" | "youtube";

export interface VideoFormat {
  /** Stable id used by the download endpoint to re-resolve the format. */
  id: string;
  label: string; // e.g. "1080p"
  note?: string; // e.g. "HD · No watermark"
  height?: number;
  ext: string; // mp4 / m4a
  kind: "video" | "audio" | "image";
  size?: number; // bytes (estimated)
}

export interface VideoInfo {
  platform: Platform;
  title: string;
  author?: string;
  thumbnail?: string;
  duration?: number; // seconds
  formats: VideoFormat[];
}

export class ExtractError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}
