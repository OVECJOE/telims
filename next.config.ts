import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    resolveAlias: {
      "sharp$": "false",
      "onnxruntime-node$": "false",
    },
  },
};

export default nextConfig;
