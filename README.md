# All Downloader

Download **TikTok**, **RedNote (Xiaohongshu)** and **YouTube Shorts / videos** without watermark.
Paste a link → the video is detected automatically → choose a quality → download.

## Run locally

Requirements: Node.js 20+ (22 recommended) and internet access.

```bash
npm install
npm run dev          # http://localhost:3000
# or production mode
npm run build && npm run start
```

No API keys are needed. The PostgreSQL database from the starter template is **not** used by the downloader.

## How it works

| Platform | Source | Qualities |
| --- | --- | --- |
| TikTok | tikwm resolver (fallback: TikTok page data) | HD / SD (no watermark) + MP3 sound |
| RedNote | Note page data (`originVideoKey` + stream list) | Original + every stream resolution |
| YouTube | `youtubei.js` (Innertube) + bundled `ffmpeg-static` | 144p → 1080p+ merged with audio, M4A audio |

* `POST /api/detect` – `{ url }` → video info + available formats
* `GET  /api/download?url=…&format=…` – streams the file as an attachment (YouTube HD streams are merged with ffmpeg, no re-encode)
* `GET  /api/thumb?u=…` – allow-listed thumbnail proxy

### RedNote tip
Use the full link from the app's **Share → Copy link** button (it contains the `xsec_token`), or an `xhslink.com` short link.

Use only for content you own or have permission to download.
