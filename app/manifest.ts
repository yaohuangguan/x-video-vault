import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "X Video Vault",
    short_name: "Video Vault",
    description: "Your private X video collection.",
    start_url: "/",
    display: "standalone",
    background_color: "#080a0c",
    theme_color: "#080a0c",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
