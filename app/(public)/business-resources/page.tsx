import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Resources | Elite Funding Solutions',
  description: 'Useful business funding resources, document checklists, cash-flow questions, and offer comparison tools for operators.',
  alternates: { canonical: '/business-resources' },
};

const resources = [
  ['Document checklist', 'Collect the last three complete business bank statements, owner ID, EIN confirmation if available, processing statements when applicable, and product-specific documents such as invoices or equipment quotes.'],
  ['Cash-flow readiness questions', 'Can the business support daily, weekly, or monthly payments? Are deposits consistent? Are there seasonal dips, existing advances, or major one-time expenses underwriters should understand?'],
  ['Offer comparison worksheet', 'Compare amount funded, total payback, payment frequency, estimated term, fees, collateral, guaranty language, renewal conditions, and closing requirements side by side.'],
  ['Responsible funding reminders', 'Avoid accepting capital solely because it is fast. Confirm use of funds, repayment capacity, and whether the product solves a short-term timing gap or a longer-term financing need.'],
];

export default function BusinessResourcesPage() {
  return <main className="bg-[#F8F9FB]"><section className="container-page py-20 md:py-28"><p className="eyebrow mb-4">Business resources</p><h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-[#0A1628] md:text-6xl">Practical tools for a cleaner funding review.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#5A6A85]">These resources help business owners prepare a better funding file, ask better questions, and compare offers without relying on hype.</p></section><section className="container-page grid gap-5 pb-16 md:grid-cols-2">{resources.map(([title, body]) => <article key={title} className="premium-card p-7"><h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{title}</h2><p className="mt-3 leading-7 text-[#5A6A85]">{body}</p></article>)}</section><section className="container-page pb-20"><div className="premium-card p-7 md:flex md:items-center md:justify-between"><div><h2 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Need help organizing your file?</h2><p className="mt-3 leading-7 text-[#5A6A85]">An advisor can walk through documentation needs and product fit before submission.</p></div><Link href="/contact" className="btn-primary mt-6 md:mt-0">Talk to an advisor</Link></div></section></main>;
}
