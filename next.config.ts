import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PDF, DOCX and OCR readers ship their own workers and WASM; bundling them
  // breaks those workers, so they are loaded from node_modules at runtime.
  serverExternalPackages: ["unpdf", "mammoth", "tesseract.js"],
};

export default nextConfig;
