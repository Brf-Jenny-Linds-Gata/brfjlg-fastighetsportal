import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brf JLG Fastighetsportal",
    short_name: "Brf JLG",
    description: "Fastighetsportal för Brf Jenny Linds Gata — underhållsplan, SBA och anmärkningar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#012247",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
