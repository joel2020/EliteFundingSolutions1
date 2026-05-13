import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Elite Funding Solutions',
  description: 'Elite Funding Solutions delivers secure, advisor-led business funding guidance backed by a nationwide marketplace of funding relationships.',
};

const pillars = [
  ['Advisor-led execution', 'A dedicated funding advisor helps organize your file, clarify the objective, and explain available structures before you move forward.'],
  ['Nationwide funding relationships', 'We support working capital, equipment financing, lines of credit, receivables financing, SBA options, revenue-based funding, and commercial real estate capital.'],
  ['Transparent comparisons', 'Review estimated terms, repayment mechanics, documentation requirements, closing conditions, and total-cost considerations in plain language.'],
  ['Secure workflows', 'Sensitive business, owner, EIN, SSN, and statement details are collected through a protected digital process designed for professional underwriting.'],
];

export default function AboutPage() {
  return (
    <main className="bg-[#F8F9FB]">
      <section className="page-hero-dark">
        <div className="container-page grid gap-12 py-24 md:py-32 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="eyebrow mb-4">About Elite</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">A premium funding desk for ambitious businesses.</h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">Elite Funding Solutions combines secure intake, disciplined file packaging, and high-touch advisory to help business owners evaluate capital options with clarity and confidence.</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 md:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C9A84C]">Our operating standard</p>
            <p className="mt-4 text-2xl font-semibold leading-snug text-white">No fake urgency. No guaranteed-approval claims. No confusing lender jargon without context.</p>
            <p className="mt-4 leading-7 text-slate-300">We position funding conversations around documentation quality, responsible repayment capacity, and terms that fit the use of funds.</p>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-5 py-16 md:grid-cols-2">
        {pillars.map(([item, copy]) => (
          <article key={item} className="premium-card p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{item}</h2>
            <p className="mt-3 leading-7 text-[#5A6A85]">{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
