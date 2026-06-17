import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Business Funding Guide | Elite Funding Solutions',
  description: 'A practical guide to business funding documents, underwriting criteria, product fit, offer comparison, and funding agreement review.',
  path: '/funding-guide',
});

const guide = [
  ['1. Define the funding objective', 'Underwriters and funding partners review whether proceeds are intended for inventory, payroll, equipment, expansion, receivables timing, debt consolidation, or emergency repairs. A clear use of funds helps match the request to the right product.'],
  ['2. Prepare a complete file', 'Most prequalification reviews begin with legal business details, EIN, owner identity information, full SSN with authorization, owner mobile phone, requested amount, revenue context, and the last three complete business bank statements.'],
  ['3. Understand what gets reviewed', 'Revenue consistency, time in business, bank activity, industry risk, existing advances, credit profile, cash-flow capacity, and documentation quality can all affect eligible offers, cost, and speed.'],
  ['4. Compare offers responsibly', 'Review total payback, payment frequency, estimated term, collateral or guaranty requirements, renewal expectations, fees, and conditions before signing. Fast funding is only useful if repayment fits the business.'],
];

export default function FundingGuidePage() {
  return (
    <main className="bg-[#030812]">
      <section className="container-page py-20 md:py-28">
        <p className="eyebrow mb-4">Funding guide</p>
        <h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-[#0A1628] md:text-6xl">How to prepare, compare, and close business funding with fewer surprises.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5A6A85]">Use this guide to understand what a funding partner is likely to review, what documents to prepare, and how to evaluate speed against cost and repayment fit.</p>
      </section>
      <section className="container-page grid gap-5 pb-16 md:grid-cols-2">
        {guide.map(([title, body]) => <article key={title} className="premium-card p-7"><h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{title}</h2><p className="mt-3 leading-7 text-[#5A6A85]">{body}</p></article>)}
      </section>
      <section className="container-page pb-20">
        <div className="rounded-[32px] bg-[#061326] p-8 text-white md:p-10"><h2 className="text-3xl font-semibold tracking-tight">Before you accept funding</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{['Confirm all fees and total repayment.', 'Make sure payment frequency matches revenue timing.', 'Read the full agreement and ask questions before signing.'].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-[#05101d]/[0.045] p-5 text-slate-200">{item}</div>)}</div><Link href="/apply" className="btn-gold mt-8">Start secure application</Link></div>
      </section>
    </main>
  );
}
