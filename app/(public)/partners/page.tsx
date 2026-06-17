import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
export const metadata: Metadata = pageMeta({ title: 'Partner With Us | Elite Funding Solutions', description: 'Funding partners, ISOs, and referral partners can partner with Elite Funding Solutions to serve U.S. business owners seeking capital.', path: '/partners' });
export default function PartnersPage(){return <section className="section"><div className="container-page"><h1 className="text-[44px] font-bold mb-5">Partner With Us</h1><p className="text-[#71717A] max-w-3xl">Funding partners and referral partners can contact Elite Funding Solutions at Info@elitefundingsol.com to discuss partnership opportunities.</p></div></section>}
