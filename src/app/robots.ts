import type { MetadataRoute } from "next";

/**
 * Vionex Projects is a private B2B application — there is nothing here for a
 * search engine, and supplier URLs must never surface publicly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
