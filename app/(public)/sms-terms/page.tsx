import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/legal-page';
import { COMPANY } from '@/lib/company';
export const metadata: Metadata = { title: 'SMS Terms | Elite Funding Solutions' };
export default function SmsTermsPage() { return <LegalPage title="SMS Terms" intro={`These SMS Terms apply when you consent to receive text messages from ${COMPANY.name}.`} sections={[
  { title: 'Consent and message types', body: ['By opting in, you consent to receive texts from Elite Funding Solutions regarding application status, document requests, underwriting updates, funding options, appointment reminders, account servicing, renewals, and related business-funding communications.'] },
  { title: 'Frequency and charges', body: ['Message frequency may vary. Message and data rates may apply depending on your wireless plan and carrier. Consent is not a condition of purchase where legally required.'] },
  { title: 'Opt-out and help', body: ['Reply STOP to opt out. Reply HELP for help. You may also contact us by phone or email. After opting out, you may receive a final confirmation message.'] },
  { title: 'Carrier disclaimer', body: ['Wireless carriers are not liable for delayed or undelivered messages. Message delivery is subject to effective transmission by your carrier and network availability.'] },
  { title: 'Privacy and contact', body: [`See our Privacy Policy at ${COMPANY.domain}/privacy-policy. Contact ${COMPANY.name} at ${COMPANY.phone} or ${COMPANY.email}.`] },
]}/>; }
