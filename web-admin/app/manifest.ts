import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlockTrax Admin",
    short_name: "FlockTrax",
    description: "Web-first admin console for FlockTrax operations and placement planning.",
    start_url: "/admin/overview",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#253125",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
