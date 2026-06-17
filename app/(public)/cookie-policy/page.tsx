import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/legal-page';
import { pageMeta } from '@/lib/seo';
export const metadata: Metadata = pageMeta({ title: 'Cookie Policy | Elite Funding Solutions', description: 'How Elite Funding Solutions uses cookies, analytics tools, and advertising pixels, and the choices available to website visitors.', path: '/cookie-policy' });
export default function CookiePolicyPage() { return <LegalPage title="Cookie Policy" intro="This Cookie Policy explains how Elite Funding Solutions uses cookies, analytics tools, and advertising pixels." sections={[
  { title: 'Analytics cookies', body: ['Analytics cookies help us understand website traffic, page views, referral sources, application funnel performance, and general visitor interactions. We may use Google Analytics or similar tools where configured.'] },
  { title: 'Advertising pixels', body: ['Advertising pixels, including Meta Pixel where configured, may help measure campaign performance, build audiences, and understand whether visitors interact with our website or application pages.'] },
  { title: 'Functional cookies', body: ['Functional cookies support website security, navigation, form operation, preferences, authentication, and other features needed for the site and CRM to function properly.'] },
  { title: 'Cookie management and opt out', body: ['You can manage cookies through your browser settings, block or delete cookies, use private browsing, or install available industry opt-out tools. Blocking cookies may affect website functionality.', 'For Google Analytics, you can use Google’s browser opt-out add-on where available. For Meta advertising, you can adjust ad preferences through Meta account settings and browser/device controls.'] },
]}/>; }
