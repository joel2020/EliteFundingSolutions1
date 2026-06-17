import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/legal-page';
import { APPLICATION_DISCLOSURE_SECTIONS } from '@/lib/application-disclosures';
import { pageMeta } from '@/lib/seo';
export const metadata: Metadata = pageMeta({ title: 'Application Authorization and Consent | Elite Funding Solutions', description: 'The authorizations and consents that apply when you submit a funding application to Elite Funding Solutions.', path: '/application-consent' });
export default function ApplicationConsentPage() { return <LegalPage title="Application Authorization and Consent" intro="This authorization reflects the Elite Funding Solutions application certification, voided-check requirement, and underwriting consent language presented before application submission." sections={[
  { title: 'Certification of accuracy', body: ['By submitting an application, each applicant and owner/principal certifies that all information and documents submitted are accurate, true, correct, current, and complete, including business information, owner information, banking information, financial records, uploaded documents, IDs, bank statements, processor statements, and voided check.'] },
  ...APPLICATION_DISCLOSURE_SECTIONS.map((section) => ({ title: section.title, body: [...section.paragraphs] })),
]}/>; }
