import type { Metadata } from 'next';
import ApplyForm from '../../apply-form';

export const metadata: Metadata = {
  title: 'Apply Through Your ISO Partner | Elite Funding Solutions',
  description: 'Securely submit a business funding application through your Elite Funding Solutions ISO partner link.',
  robots: { index: false, follow: false },
};

function labelFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function IsoApplyPage({ params }: { params: { slug: string } }) {
  const code = decodeURIComponent(params.slug).trim().toLowerCase();
  return <ApplyForm referral={{ code, path: `/apply/iso/${encodeURIComponent(code)}`, repName: labelFromSlug(code) }} />;
}
