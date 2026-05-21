import type { Metadata } from 'next';
import ApplyForm from '../../apply-form';

export const metadata: Metadata = {
  title: 'Apply with Your Funding Advisor | Elite Funding Solutions',
  description: 'Securely submit a business funding application through your Elite Funding Solutions advisor link.',
  robots: { index: false, follow: false },
};

export default function RepApplyPage({ params }: { params: { slug: string } }) {
  const code = decodeURIComponent(params.slug).trim().toLowerCase();
  return <ApplyForm referral={{ code, path: `/apply/rep/${encodeURIComponent(code)}`, repName: 'your funding advisor' }} />;
}
