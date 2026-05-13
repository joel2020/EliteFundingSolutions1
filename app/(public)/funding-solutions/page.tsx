import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { fundingSolutions } from '@/lib/content/site';

export const metadata: Metadata = {
  title: 'Funding Solutions | Elite Funding Solutions',
  description: 'Compare working capital, equipment financing, SBA loans, business lines of credit, invoice factoring, commercial real estate financing, and revenue-based funding options.',
  alternates: { canonical: '/funding-solutions' },
};

export default function FundingSolutionsPage() {
  return (
    <main className="bg-[#030812]">
      <section className="page-hero-dark">
        <div className="container-page py-24 md:py-32">
          <p className="eyebrow mb-4">Funding solutions</p>
          <h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">Capital products built around your growth plan.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Elite Funding Solutions helps established businesses compare available funding structures with clear guidance on speed, documentation, repayment mechanics, and use-case fit.</p>
        </div>
      </section>
      <section className="container-page grid gap-5 py-16 md:grid-cols-2 lg:grid-cols-3">
        {fundingSolutions.map((solution) => (
          <article id={solution.anchor} key={solution.slug} className="premium-card flex min-h-[360px] flex-col p-7">
            <div className="mb-5 inline-flex w-fit rounded-full bg-[#FBF6E9] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A22]">{solution.range}</div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{solution.title}</h2>
            <p className="mt-3 flex-1 leading-7 text-[#5A6A85]">{solution.summary}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[#030812] p-4"><dt className="text-[#5A6A85]">Typical review</dt><dd className="mt-1 font-semibold text-[#0A1628]">{solution.speed}</dd></div>
              <div className="rounded-2xl bg-[#030812] p-4"><dt className="text-[#5A6A85]">Starting docs</dt><dd className="mt-1 font-semibold text-[#0A1628]">{solution.documents.length}+ items</dd></div>
            </dl>
            <Link href={`/funding-solutions/${solution.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-[#0A1628]">View product details <ArrowRight className="h-4 w-4" /></Link>
          </article>
        ))}
      </section>
      <section className="container-page pb-16">
        <div className="rounded-[32px] bg-[#061326] p-8 text-white md:flex md:items-center md:justify-between md:p-10">
          <div><h2 className="text-3xl font-semibold tracking-tight">Not sure which product fits?</h2><p className="mt-3 text-slate-300">Submit one secure application and compare available structures with an advisor.</p></div>
          <Link href="/apply" className="btn-gold mt-6 md:mt-0">Apply securely</Link>
        </div>
      </section>
    </main>
  );
}
