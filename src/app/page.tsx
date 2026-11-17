import Downloader from "@/components/Downloader";
import { AppLogo, FacebookLogo, RedNoteLogo, TikTokLogo, YouTubeLogo } from "@/components/Logos";

const steps = [
  { n: "1", title: "Paste the link", text: "Use a public link from TikTok, RedNote, Facebook or YouTube." },
  { n: "2", title: "Choose what to save", text: "Download videos, individual photos, or all photos from one post as a ZIP." },
  { n: "3", title: "Download", text: "Choose a video quality or save the available post media." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0A1128] via-[#0F1B4C] to-[#1E2A78] pb-24 pt-6 text-white">
        <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -top-10 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />

        <header className="relative mx-auto flex max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <AppLogo size={40} />
            <span className="text-xl font-extrabold tracking-tight">
              All <span className="text-sky-400">Downloader</span>
            </span>
          </div>
          <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100 ring-1 ring-white/15 sm:inline">
            Free · No watermark · No sign-up
          </span>
        </header>

        <div className="relative mx-auto mt-14 max-w-3xl px-5 text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Download videos and photos
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-blue-100/80 sm:text-lg">
            One tool for TikTok, RedNote, Facebook and YouTube. Paste a public link to save videos or photo posts.
          </p>

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Chip><TikTokLogo size={20} /> TikTok</Chip>
            <Chip><RedNoteLogo size={20} /> RedNote</Chip>
            <Chip><FacebookLogo size={20} /> Facebook</Chip>
            <Chip><YouTubeLogo size={20} /> YouTube</Chip>
          </div>
        </div>

        <div className="relative mx-auto mt-9 max-w-3xl px-5 text-left">
          <Downloader />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">How it works</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-extrabold text-white">
                {s.n}
              </div>
              <h3 className="font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          All Downloader is intended for saving content you own or have permission to download. Respect creators&rsquo;
          rights and each platform&rsquo;s terms of service. TikTok, RedNote, Facebook and YouTube are trademarks of their
          respective owners; this tool is not affiliated with them.
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} All Downloader
      </footer>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur">
      {children}
    </span>
  );
}
