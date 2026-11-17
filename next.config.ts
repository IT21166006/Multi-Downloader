import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  serverExternalPackages: ["ffmpeg-static", "youtubei.js"],
};

export default nextConfig;
