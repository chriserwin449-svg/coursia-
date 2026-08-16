import type { MetadataRoute } from "next";

const SITE_URL = "https://coursia.app";
// Fixed date — the launch date of the site, avoids signaling constant changes
const SITE_LAUNCH = new Date("2025-07-15");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: SITE_LAUNCH,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
