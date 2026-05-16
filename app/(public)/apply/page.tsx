import type { Metadata } from 'next';
import ApplyForm from './apply-form';

export const metadata: Metadata = {
  title: 'Apply for Funding | Elite Funding Solutions',
  description: 'Securely apply for business funding with Elite Funding Solutions. Submit business details, owner authorization, and bank statements for prequalification review.',
  alternates: { canonical: '/apply' },
};

export default function ApplyPage({ searchParams }: { searchParams?: { rep?: string } }) {
  const code = searchParams?.rep?.trim() || '';
  return <ApplyForm referral={code ? { code, path: `/apply?rep=${encodeURIComponent(code)}` } : undefined} />;
}
