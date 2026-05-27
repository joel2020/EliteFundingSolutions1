import type { Metadata } from 'next';
import ApplyForm from './apply-form';

export const metadata: Metadata = {
  title: 'Apply for Funding | Elite Funding Solutions',
  description: 'Securely apply for business funding with Elite Funding Solutions. Submit business details, owner authorization, and bank statements for prequalification review.',
  alternates: { canonical: '/apply' },
};

export default async function ApplyPage({ searchParams }: { searchParams?: Promise<{ rep?: string; iso?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const repCode = resolvedSearchParams?.rep?.trim() || '';
  const isoCode = resolvedSearchParams?.iso?.trim() || '';
  const code = repCode || isoCode;
  const source = isoCode ? 'iso' : 'rep';
  return <ApplyForm referral={code ? { code, path: `/apply?${source}=${encodeURIComponent(code)}` } : undefined} />;
}
