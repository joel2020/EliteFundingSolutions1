import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers | Elite Funding Solutions',
  description: 'Careers and operator opportunities at Elite Funding Solutions.',
  alternates: { canonical: '/careers' },
};

export default function CareersPage() {
  return <main className="bg-[#F8F9FB]"><section className="page-hero-dark"><div className="container-page py-20 md:py-28"><p className="eyebrow mb-4">Careers</p><h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">Built for disciplined operators.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">We are not actively hiring, but exceptional operators may contact us.</p></div></section><section className="container-page grid gap-5 py-16 md:grid-cols-3">{['Funding advisory', 'Operations and document workflow', 'Partner relationship support'].map((role) => <article key={role} className="premium-card p-7"><h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{role}</h2><p className="mt-3 leading-7 text-[#5A6A85]">We value compliance-minded communication, urgency without pressure tactics, clean documentation, and respect for sensitive applicant data.</p></article>)}</section><section className="container-page pb-20"><div className="rounded-[32px] bg-white p-8 shadow-sm md:p-10"><h2 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Introduce yourself</h2><p className="mt-3 max-w-2xl leading-7 text-[#5A6A85]">If your background fits premium business funding operations, send a concise note with relevant experience. Please do not send sensitive personal information through the contact form.</p><Link href="/contact" className="btn-primary mt-6">Contact Elite</Link></div></section></main>;
}
