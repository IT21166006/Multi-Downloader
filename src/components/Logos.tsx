import type { Platform } from "@/lib/types";

export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="All Downloader logo">
      <defs>
        <linearGradient id="adg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#adg)" />
      <path d="M24 10v17" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 20.5l8 8 8-8" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 36.5h22" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function TikTokLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="TikTok">
      <rect width="24" height="24" rx="6" fill="#000" />
      <g transform="translate(4.2 3.8) scale(0.65)">
        <path
          transform="translate(-1.2 0.8)"
          d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
          fill="#25F4EE"
        />
        <path
          transform="translate(1.2 -0.8)"
          d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
          fill="#FE2C55"
        />
        <path
          d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}

export function YouTubeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="YouTube">
      <rect width="24" height="24" rx="6" fill="#fff" />
      <g transform="translate(2 2) scale(0.833)">
        <path
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
          fill="#FF0000"
        />
      </g>
    </svg>
  );
}

export function RedNoteLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="RedNote">
      <rect width="24" height="24" rx="6" fill="#FF2442" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="8.6"
        fontWeight="800"
        fill="#fff"
        fontFamily="'PingFang SC','Microsoft YaHei',system-ui,sans-serif"
      >
        小红书
      </text>
    </svg>
  );
}

export function FacebookLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Facebook">
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path
        d="M13.6 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6H17V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.8V21h3.3z"
        fill="#fff"
      />
    </svg>
  );
}

export function PlatformLogo({ platform, size = 24 }: { platform: Platform; size?: number }) {
  if (platform === "tiktok") return <TikTokLogo size={size} />;
  if (platform === "youtube") return <YouTubeLogo size={size} />;
  if (platform === "facebook") return <FacebookLogo size={size} />;
  return <RedNoteLogo size={size} />;
}

export const PLATFORM_META: Record<Platform, { name: string; color: string }> = {
  tiktok: { name: "TikTok", color: "#FE2C55" },
  youtube: { name: "YouTube", color: "#FF0000" },
  facebook: { name: "Facebook", color: "#1877F2" },
  rednote: { name: "RedNote", color: "#FF2442" },
};
