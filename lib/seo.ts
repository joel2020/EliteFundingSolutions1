import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';

/** Default social share image used when a page doesn't supply its own. */
export const DEFAULT_OG_IMAGE = '/Elite_Funding_Solutions_Logo_Final.jpg';

type PageMetaInput = {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/about". Defaults to "/". */
  path?: string;
  /** Override the social share image. Defaults to the Elite Funding Solutions card. */
  image?: string;
  /** OG type — "website" (default) or "article" for blog posts. */
  type?: 'website' | 'article';
};

/**
 * Builds a complete, consistent Metadata object for a page: title, description,
 * self-referencing canonical, and per-page Open Graph + Twitter cards (each with
 * an explicit share image so previews never fall back to a blank card).
 */
export function pageMeta({ title, description, path = '/', image = DEFAULT_OG_IMAGE, type = 'website' }: PageMetaInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url,
      siteName: 'Elite Funding Solutions',
      title,
      description,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
