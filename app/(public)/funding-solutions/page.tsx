import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { fundingSolutions } from '@/lib/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Funding Solutions | Elite Funding Solutions',
  description: 'Compare working capital, equipment financing, SBA loans, business lines of credit, invoice factoring, commercial real estate financing, and revenue-based funding options.',
  path: '/funding-solutions',
});

const comparisonRows = [
  ['Working Capital', 'Operating cash flow, payroll, inventory', '24-72 hours', 'Bank statements, business profile'],
  ['Line of Credit', 'Repeat purchases and reserve planning', '1-5 business days', 'Bank statements, owner ID'],
  ['Equipment Financing', 'Revenue-producing assets', '2-7 business days', 'Quote, bank statements, entity docs'],
  ['Invoice Factoring', 'B2B receivables and payroll float', '3-10 business days', 'A/R aging, invoices, customer list'],
  ['SBA Loans', 'Lower-cost growth capital', '30-90 days', 'Tax returns, financials, debt schedule'],
];

export default function FundingSolutionsPage() {
  return (
    <main className="bg-[#030812] text-white">
      <section className="page-hero-dark">
        <div className="container-page py-24 md:py-32">
          <p className="eyebrow mb-4">Funding solutions</p>
          <h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-7xl">Capital products built around your growth plan.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Elite Funding Solutions helps established businesses compare available funding structures with clear guidance on speed, documentation, repayment mechanics, and use-case fit.</p>
        </div>
      </section>
      <section className="container-page grid gap-5 py-16 md:grid-cols-2 lg:grid-cols-3">
        {fundingSolutions.map((solution) => (
          <article id={solution.anchor} key={solution.slug} className="flex min-h-[360px] flex-col rounded-sm border border-[#d6af62]/18 bg-[#081523] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-[#d6af62]/45">
            <div className="mb-5 inline-flex w-fit rounded-full bg-[#FBF6E9] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A22]">{solution.range}</div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">{solution.title}</h2>
            <p className="mt-3 flex-1 leading-7 text-slate-300">{solution.summary}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-sm border border-[#d6af62]/12 bg-[#030812] p-4"><dt className="text-slate-500">Typical review</dt><dd className="mt-1 font-semibold text-white">{solution.speed}</dd></div>
              <div className="rounded-sm border border-[#d6af62]/12 bg-[#030812] p-4"><dt className="text-slate-500">Starting docs</dt><dd className="mt-1 font-semibold text-white">{solution.documents.length}+ items</dd></div>
            </dl>
            <Link href={`/funding-solutions/${solution.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-[#d6af62]">View product details <ArrowRight className="h-4 w-4" /></Link>
          </article>
        ))}
      </section>
      <section className="container-page pb-16">
        <div className="overflow-hidden rounded-sm border border-[#d6af62]/18 bg-[#071322]">
          <div className="border-b border-[#d6af62]/14 p-6 md:p-8">
            <p className="eyebrow mb-3">Product comparison</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">Match the structure to the job.</h2>
            <p className="mt-3 max-w-3xl text-slate-400">Speed matters, but repayment style, documentation, and use-case fit matter more. This table gives owners a cleaner first-pass comparison.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#030812] text-xs uppercase tracking-[0.16em] text-[#d6af62]">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Best fit</th>
                  <th className="px-5 py-4">Typical review</th>
                  <th className="px-5 py-4">Starting docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6af62]/10 text-slate-300">
                {comparisonRows.map(([product, fit, review, docs]) => (
                  <tr key={product}>
                    <td className="px-5 py-4 font-semibold text-white">{product}</td>
                    <td className="px-5 py-4">{fit}</td>
                    <td className="px-5 py-4">{review}</td>
                    <td className="px-5 py-4">{docs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="container-page pb-16">
        <div className="rounded-sm border border-[#d6af62]/18 bg-[#061326] p-8 text-white md:flex md:items-center md:justify-between md:p-10">
          <div><h2 className="text-3xl font-semibold tracking-tight text-white">Not sure which product fits?</h2><p className="mt-3 text-slate-300">Start with a light fit check or submit a full secure application when the file is ready.</p></div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-0">
            <Link href="/funding-fit-check" className="btn-gold">Request fit check</Link>
            <Link href="/apply" className="btn-dark-outline">Apply securely</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
