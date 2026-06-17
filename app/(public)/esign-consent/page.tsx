import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/legal-page';
import { pageMeta } from '@/lib/seo';
export const metadata: Metadata = pageMeta({ title: 'E-Sign Consent | Elite Funding Solutions', description: 'How Elite Funding Solutions uses electronic records and electronic signatures in the application and funding workflow.', path: '/esign-consent' });
export default function ESignConsentPage() { return <LegalPage title="E-Sign Consent" intro="This consent explains use of electronic records and electronic signatures in the Elite Funding Solutions application and funding workflow." sections={[
  { title: 'Consent to electronic signatures and records', body: ['You consent to use electronic signatures, electronic records, electronic notices, electronic disclosures, and electronic communications for applications, authorizations, consents, funding documents, servicing, renewals, and related transactions.'] },
  { title: 'Legal effect', body: ['You agree that your electronic signature, typed name, checkbox selection, click, or other electronic action has the same legal effect as a handwritten signature to the fullest extent permitted by the federal E-SIGN Act, UETA, and other applicable law.'] },
  { title: 'Right to withdraw consent', body: ['You may withdraw consent to electronic records by contacting us. Withdrawal may slow or prevent online application processing and does not affect the validity of electronic records or signatures provided before withdrawal.'] },
  { title: 'Hardware and software requirements', body: ['You need internet access, a device capable of displaying web pages and PDF or HTML records, an active email address or phone number, a current browser with cookies and JavaScript enabled, and the ability to download, print, or save records.'] },
  { title: 'Submission evidence', body: ['Timestamp, IP address, user agent, signed name, signature date, consent version, and checkbox selections should be stored with each application submission for audit, attribution, compliance, and evidence of consent.'] },
]}/>; }
