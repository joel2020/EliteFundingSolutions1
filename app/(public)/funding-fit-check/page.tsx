import type { Metadata } from 'next';
import FundingFitCheckForm from './funding-fit-check-form';

export const metadata: Metadata = {
  title: 'Funding Fit Check | Elite Funding Solutions',
  description: 'Request a light funding fit review before completing the full secure business funding application.',
  alternates: { canonical: '/funding-fit-check' },
};

export default function FundingFitCheckPage() {
  return <FundingFitCheckForm />;
}
