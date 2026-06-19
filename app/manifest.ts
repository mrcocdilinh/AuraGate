import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AuraGate — agent payments gateway",
    short_name: "AuraGate",
    description: "The open registry for AI agents to move value. x402 payments on Arc.",
    start_url: "/",
    display: "standalone",
    background_color: "#030A18",
    theme_color: "#030A18",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
