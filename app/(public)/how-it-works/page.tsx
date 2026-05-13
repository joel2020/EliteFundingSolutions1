import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works | Elite Funding Solutions',
  description: 'How Elite Funding Solutions collects application details, coordinates underwriting review, compares offers, and supports applicants before funding.',
  alternates: { canonical: '/how-it-works' },
};

const steps = [
  { n: '01', title: 'Submit a secure application', applicant: 'The applicant submits business identity details, full EIN, owner information, full SSN with authorization, owner mobile phone, requested amount, use of funds, and the last three business bank statements.', review: 'Elite reviews the file for completeness, missing documents, internal consistency, and consent records before a funding partner review.' },
  { n: '02', title: 'Underwriting reviews the file', applicant: 'The applicant may clarify revenue, existing advances, ownership details, seasonal patterns, or document gaps if requested.', review: 'Underwriting may evaluate revenue consistency, bank activity, time in business, industry profile, credit authorization, cash-flow capacity, existing obligations, and product-specific documents.' },
  { n: '03', title: 'Compare available offers', applicant: 'The applicant reviews available structures and asks questions before deciding whether to proceed.', review: 'Elite helps compare amount, estimated total payback, repayment frequency, expected term, fees, speed, funding conditions, and fit for the stated use of funds.' },
  { n: '04', title: 'Confirm conditions before funding', applicant: 'Before funding, the applicant reviews final agreements, verifies closing conditions, and should read all terms carefully.', review: 'Final steps may include identity verification, bank or processor verification, payoff letters, signed agreements, and partner-specific funding conditions. Approval and timing are not guaranteed.' },
];

export default function HowItWorksPage() {
  return (
    <main className="bg-[#040B16] text-white">
      <section className="container-page py-20 md:py-28">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#E3C77A]">How it works</p>
        <h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">A disciplined path from secure intake to funding decision.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">The process is designed to reduce incomplete files, clarify underwriting expectations, and help business owners compare offers before signing.</p>
      </section>
      <section className="container-page grid gap-5 pb-16 md:grid-cols-2">
        {steps.map((step) => <article key={step.n} className="rounded-[24px] border border-white/10 bg-[#07111F] p-7"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#C9A84C]/60 text-sm font-bold text-[#F2D98A]">{step.n}</div><h2 className="text-2xl font-semibold tracking-tight text-white">{step.title}</h2><div className="mt-5 grid gap-4"><div><h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-200">What the applicant submits</h3><p className="mt-2 leading-7 text-slate-300">{step.applicant}</p></div><div><h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-200">What underwriting reviews</h3><p className="mt-2 leading-7 text-slate-300">{step.review}</p></div></div></article>)}
      </section>
      <section className="container-page pb-20"><div className="rounded-[32px] border border-[#C9A84C]/20 bg-[#101D2F] p-8 md:flex md:items-center md:justify-between md:gap-8"><div><h2 className="text-3xl font-semibold tracking-tight text-white">Ready to prepare a complete file?</h2><p className="mt-3 max-w-2xl leading-7 text-slate-300">There is no obligation to accept an offer, and funding availability depends on underwriting review and final agreements.</p></div><Link href="/apply" className="btn-gold mt-6 md:mt-0">Get Pre-Qualified</Link></div></section>
    </main>
  );
}
