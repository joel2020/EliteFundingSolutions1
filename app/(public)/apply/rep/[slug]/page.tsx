import type { Metadata } from 'next';
import ApplyForm from '../../apply-form';

export const metadata: Metadata = {
  title: 'Apply with Your Funding Advisor | Elite Funding Solutions',
  description: 'Securely submit a business funding application through your Elite Funding Solutions advisor link.',
  robots: { index: false, follow: false },
};

function labelFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function RepApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = decodeURIComponent(slug).trim().toLowerCase();
  return <ApplyForm referral={{ code, path: `/apply/rep/${encodeURIComponent(code)}`, repName: labelFromSlug(code) }} />;
}
