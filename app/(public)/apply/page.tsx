import type { Metadata } from 'next';
import ApplyForm from './apply-form';

export const metadata: Metadata = {
  title: 'Apply for Funding | Elite Funding Solutions',
  description: 'Securely apply for business funding with Elite Funding Solutions. Submit business details, owner authorization, and bank statements for prequalification review.',
  alternates: { canonical: '/apply' },
};

export default function ApplyPage({ searchParams }: { searchParams?: { rep?: string; iso?: string; deal?: string } }) {
  const repCode = searchParams?.rep?.trim() || '';
  const isoCode = searchParams?.iso?.trim() || '';
  const dealCode = searchParams?.deal?.trim() || '';
  const code = repCode || isoCode || dealCode;
  const source = dealCode ? 'deal' : isoCode ? 'iso' : 'rep';
  return <ApplyForm referral={code ? { code, path: `/apply?${source}=${encodeURIComponent(code)}` } : undefined} />;
}
