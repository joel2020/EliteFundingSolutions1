import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { fundingSolutions } from '@/lib/content/site';

export const metadata: Metadata = {
  title: 'Funding Solutions | Elite Funding Solutions',
  description: 'Compare working capital, equipment financing, SBA loans, business lines of credit, invoice factoring, commercial real estate financing, and merchant cash advances.',
  alternates: { canonical: '/funding-solutions' },
};

export default function FundingSolutionsPage() {
  return (
    <div className="bg-[#040B16] text-white">
      <section className="container-page py-20">
        <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]">Funding Solutions</p>
        <div className="max-w-3xl">
          <h1 className="mb-5 font-display text-[44px] font-semibold leading-tight tracking-tight md:text-[64px]">Capital products built around your growth plan.</h1>
          <p className="text-[18px] leading-relaxed text-[#B9C2D0]">Elite Funding Solutions structures fast, flexible funding across an institutional network of lending partners so founders can compare options without slowing down operations.</p>
        </div>
      </section>
      <section className="container-page grid grid-cols-1 gap-5 pb-20 md:grid-cols-2 lg:grid-cols-3">
        {fundingSolutions.map((solution) => (
          <article id={solution.anchor} key={solution.slug} className="rounded-[22px] border border-white/10 bg-[#07111f] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
            <div className="mb-5 inline-flex rounded-full border border-[#C9A45C]/30 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#E3C77A]">{solution.range}</div>
            <h2 className="mb-3 font-display text-[26px] font-semibold">{solution.title}</h2>
            <p className="mb-5 text-[15px] leading-relaxed text-[#B9C2D0]">{solution.summary}</p>
            <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-[#B9C2D0]">Speed</dt><dd className="font-semibold text-white">{solution.speed}</dd></div>
              <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-[#B9C2D0]">Documents</dt><dd className="font-semibold text-white">{solution.documents.length}+ items</dd></div>
            </dl>
            <Link href={`/funding-solutions/${solution.slug}`} className="inline-flex items-center gap-2 text-[#E3C77A] font-semibold text-[14px]">View product details <ArrowRight className="h-4 w-4" /></Link>
          </article>
        ))}
      </section>
      <section className="container-page pb-20">
        <div className="rounded-[28px] border border-[#C9A45C]/20 bg-[#101D2F] p-8 md:flex md:items-center md:justify-between">
          <div><h2 className="font-display text-3xl font-semibold">Not sure which product fits?</h2><p className="mt-2 text-[#B9C2D0]">Submit one secure application and compare available structures with an advisor.</p></div>
          <Link href="/apply" className="mt-6 inline-flex rounded-sm bg-[#C9A45C] px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#07111F] md:mt-0">Apply securely</Link>
        </div>
      </section>
    </div>
  );
}
