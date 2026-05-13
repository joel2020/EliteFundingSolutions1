import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Elite Funding Solutions — Fast, Flexible Capital for Ambitious Businesses',
    template: '%s | Elite Funding Solutions',
  },
  description: 'Elite Funding Solutions provides fast, flexible business capital from $10K to $5M with white-glove guidance, streamlined approvals, and a nationwide funding partner network.',
  keywords: ['business funding', 'merchant cash advance', 'working capital', 'equipment financing', 'SBA loans', 'business line of credit', 'invoice factoring'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Elite Funding Solutions',
    title: 'Elite Funding Solutions — Fast, Flexible Capital for Ambitious Businesses',
    description: 'Premium business funding solutions with streamlined approvals and white-glove service.',
    images: [{ url: '/Elite_Funding_Solutions_Logo_Final.jpg', width: 1672, height: 940, alt: 'Elite Funding Solutions' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Elite Funding Solutions',
    description: 'Fast, flexible capital for ambitious businesses.',
    images: ['/Elite_Funding_Solutions_Logo_Final.jpg'],
  },
  icons: {
    icon: '/elite-funding-logo.png',
    shortcut: '/elite-funding-logo.png',
    apple: '/elite-funding-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: 'Elite Funding Solutions',
    url: siteUrl,
    logo: `${siteUrl}/elite-funding-logo.png`,
    telephone: '+1-888-400-2580',
    email: 'info@elitefundingsolution.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '590 Madison Avenue',
      addressLocality: 'New York',
      addressRegion: 'NY',
      postalCode: '10022',
      addressCountry: 'US',
    },
    areaServed: 'US',
    sameAs: ['https://www.elitefundingsolution.com'],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-[#F8F9FB] text-[#0A1628]`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
