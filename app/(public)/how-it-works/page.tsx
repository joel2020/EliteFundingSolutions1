import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How It Works | Elite Funding Solutions', description: 'Submit your application, review tailored offers, and receive funding quickly.' };

const steps = [
  ['1', 'Submit your application', 'Complete a secure intake in minutes with business, owner, funding, banking, and document details.'],
  ['2', 'Review tailored offers', 'Our team packages your file and compares options across appropriate funding partners.'],
  ['3', 'Receive funding quickly', 'Choose the offer that fits your business and receive funds after final underwriting and contracts.'],
];

export default function HowItWorksPage() {
  return <section className="section bg-[#040B16] text-white min-h-screen"><div className="container-page"><p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C] mb-4">How It Works</p><h1 className="text-[44px] md:text-[60px] font-bold tracking-tight mb-12 max-w-3xl">A streamlined path from application to capital.</h1><div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">{steps.map(([n,t,d])=><div key={n} className="rounded-[18px] border border-[#1A2B4A] bg-[#07111f] p-7"><div className="w-12 h-12 rounded-full border border-[#C9A84C] text-[#C9A84C] flex items-center justify-center mb-6">{n}</div><h2 className="text-[22px] font-semibold mb-3">{t}</h2><p className="text-[#8C9BB5] leading-relaxed">{d}</p></div>)}</div><Link href="/apply" className="inline-flex rounded-[10px] bg-[#C9A84C] px-6 py-3 font-semibold text-[#040B16]">Get Pre-Qualified</Link></div></section>;
}
