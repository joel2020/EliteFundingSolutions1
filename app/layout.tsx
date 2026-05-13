import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { COMPANY } from '@/lib/company';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elitefundingsolution.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Elite Funding Solutions — Institutional Business Funding & Private Credit Advisory',
    template: '%s | Elite Funding Solutions',
  },
  description: 'Elite Funding Solutions provides secure advisor-led business funding, working capital, revenue-based financing, lines of credit, equipment financing, SBA options, invoice factoring, and commercial real estate capital for U.S. operators.',
  keywords: ['business funding', 'working capital', 'merchant cash advance', 'revenue-based financing', 'equipment financing', 'SBA loans', 'business line of credit', 'invoice factoring', 'fast business funding', 'small business funding'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Elite Funding Solutions',
    title: 'Elite Funding Solutions — Institutional Business Funding & Private Credit Advisory',
    description: 'Premium business funding solutions with secure intake, responsible underwriting guidance, and white-glove offer comparison.',
    images: [{ url: '/Elite_Funding_Solutions_Logo_Final.jpg', width: 1672, height: 940, alt: 'Elite Funding Solutions' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Elite Funding Solutions',
    description: 'Institutional business funding and private credit advisory for ambitious operators.',
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
    telephone: COMPANY.phoneHref,
    email: COMPANY.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.street,
      addressLocality: COMPANY.city,
      addressRegion: COMPANY.state,
      postalCode: COMPANY.zip,
      addressCountry: 'US',
    },
    areaServed: 'US',
    sameAs: [COMPANY.domain],
    makesOffer: ['Working capital', 'Revenue-based financing', 'Merchant cash advance', 'Business line of credit', 'Equipment financing', 'Invoice factoring', 'SBA loans', 'Commercial real estate financing'],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#F8F9FB] text-[#0A1628]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
