import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';

type PageMetaInput = {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/about". Defaults to "/". */
  path?: string;
  /** Override the social share image. Defaults to the site-wide generated OG image. */
  image?: string;
  /** OG type — "website" (default) or "article" for blog posts. */
  type?: 'website' | 'article';
};

/**
 * Builds a complete, consistent Metadata object for a page: title, description,
 * self-referencing canonical, and per-page Open Graph + Twitter cards.
 *
 * `images` is intentionally omitted so the site-wide file-convention OG image
 * (app/opengraph-image.tsx) is inherited unless a page passes an explicit `image`.
 */
export function pageMeta({ title, description, path = '/', image, type = 'website' }: PageMetaInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  const og: Metadata['openGraph'] = {
    type,
    url,
    siteName: 'Elite Funding Solutions',
    title,
    description,
  };
  if (image) og.images = [{ url: image }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: og,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
