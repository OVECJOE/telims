import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    resolveAlias: {
      "sharp$": "false",
      "onnxruntime-node$": "false",
    },
  },
};

export default nextConfig;
