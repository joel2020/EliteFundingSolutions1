import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/funding-solutions', '/industries', '/about', '/resources', '/blog', '/faq', '/contact', '/apply', '/privacy', '/terms', '/how-it-works'];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
