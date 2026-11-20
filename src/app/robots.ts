import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/settings",
          "/following",
          "/new",
          "/login",
          "/auth/",
          "/api/",
          "/d/",
          "/p/*/edit",
          "/p/*/release",
          "/p/*/traffic",
        ],
      },
    ],
    sitemap: env.siteUrl ? `${env.siteUrl}/sitemap.xml` : undefined,
  };
}
