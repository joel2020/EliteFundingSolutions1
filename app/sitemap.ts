import type { MetadataRoute } from 'next';
import { blogPosts, fundingSolutions, industries } from '@/lib/content/site';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/funding-solutions', '/industries', '/about', '/resources', '/blog', '/faq', '/contact', '/apply', '/privacy-policy', '/terms-of-use', '/application-consent', '/esign-consent', '/sms-terms', '/cookie-policy', '/disclosures', '/privacy', '/terms', '/how-it-works', '/careers', '/why-choose-elite', '/funding-guide', '/business-resources', '/industry-insights', '/case-studies', '/sitemap'];
  const dynamicRoutes = [
    ...fundingSolutions.map((item) => `/funding-solutions/${item.slug}`),
    ...industries.map((item) => `/industries/${item.slug}`),
    ...blogPosts.map((item) => `/blog/${item.slug}`),
  ];
  return [...staticRoutes, ...dynamicRoutes].map((route) => ({ url: `${siteUrl}${route}`, lastModified: new Date('2026-05-13'), changeFrequency: route === '' ? 'weekly' : 'monthly', priority: route === '' ? 1 : route.includes('/blog/') ? 0.7 : 0.8 }));
}
