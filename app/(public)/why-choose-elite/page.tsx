import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, FileCheck2, Handshake, LockKeyhole, Scale, ShieldCheck, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Why Choose Elite | Elite Funding Solutions',
  description: 'Why businesses choose Elite Funding Solutions for secure intake, clear offer comparisons, responsible funding guidance, and access to a funding partner network.',
  alternates: { canonical: '/why-choose-elite' },
};

const differentiators = [
  ['Complete-file discipline', 'We help applicants submit the business profile, owner information, consent records, and bank statements underwriters need to review the request without unnecessary back-and-forth.', FileCheck2],
  ['Partner-network access', 'Elite Funding Solutions works with a marketplace of funding partners, lenders, funders, banks, and specialty programs instead of forcing every business into one product.', Users],
  ['Transparent comparisons', 'Advisors explain repayment mechanics, estimated total cost, documentation conditions, and funding timelines before an applicant accepts an offer.', Scale],
  ['Security-minded intake', 'Sensitive EIN, SSN, consent, and document uploads are handled through a protected application workflow designed for business funding review.', LockKeyhole],
];

const standards = ['No guaranteed-approval claims', 'No fake lender logos or invented funded-volume stats', 'No request for routing or full account numbers during initial prequalification', 'No pressure to accept an offer that does not fit cash flow'];

export default function WhyChooseElitePage() {
  return (
    <main className="bg-[#030812]">
      <section className="page-hero-dark">
        <div className="container-page py-20 md:py-28">
          <p className="eyebrow mb-4">Why choose Elite</p>
          <h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">A more disciplined way to compare business funding.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Elite Funding Solutions is built for operators who want speed with context: secure intake, organized documentation, responsible underwriting expectations, and plain-English offer review.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/apply" className="btn-gold">Start secure application</Link><Link href="/funding-solutions" className="btn-dark-outline">Compare products</Link></div>
        </div>
      </section>

      <section className="container-page grid gap-5 py-16 md:grid-cols-2">
        {differentiators.map(([title, text, Icon]) => (
          <article key={title as string} className="premium-card p-7">
            <Icon className="h-7 w-7 text-[#8A6A22]" />
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#0A1628]">{title as string}</h2>
            <p className="mt-3 leading-7 text-[#5A6A85]">{text as string}</p>
          </article>
        ))}
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-6 rounded-[32px] bg-[#061326] p-8 text-white md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div><ShieldCheck className="h-8 w-8 text-[#C9A84C]" /><h2 className="mt-5 text-3xl font-semibold tracking-tight">Trusted funding process</h2><p className="mt-4 leading-7 text-slate-300">We use clear disclosures, documented applicant consents, and a partner-network model so business owners understand who may review their file and why.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{standards.map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-[#05101d]/[0.045] p-4"><Handshake className="mt-1 h-4 w-4 shrink-0 text-[#C9A84C]" /><span className="text-sm leading-6 text-slate-200">{item}</span></div>)}</div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="premium-card p-7 md:flex md:items-center md:justify-between md:gap-8">
          <div><h2 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Ready to see which structures may fit?</h2><p className="mt-3 max-w-2xl leading-7 text-[#5A6A85]">Submit one secure funding file and review available options without an obligation to accept.</p></div>
          <Link href="/apply" className="btn-primary mt-6 md:mt-0">Apply securely <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
