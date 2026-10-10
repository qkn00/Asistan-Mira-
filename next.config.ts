import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static gibi çalıştırılabilir dosya barındıran paketler bundle edilmemeli;
  // aksi hâlde __dirname /ROOT olur ve binary yolu çözülemez (spawn ENOENT).
  serverExternalPackages: ["ffmpeg-static", "@andresaya/edge-tts"],
};

export default nextConfig;
