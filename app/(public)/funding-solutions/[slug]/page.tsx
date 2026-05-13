import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fundingSolutions } from '@/lib/content/site';

export function generateStaticParams() { return fundingSolutions.map(({ slug }) => ({ slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const item = fundingSolutions.find((solution) => solution.slug === params.slug);
  if (!item) return {};
  return { title: `${item.title} | Elite Funding Solutions`, description: `${item.summary} Typical range ${item.range}; speed ${item.speed}.`, alternates: { canonical: `/funding-solutions/${item.slug}` } };
}
export default function FundingDetailPage({ params }: { params: { slug: string } }) {
  const item = fundingSolutions.find((solution) => solution.slug === params.slug);
  if (!item) notFound();
  const schema = { '@context': 'https://schema.org', '@type': 'FinancialProduct', name: item.title, description: item.summary, provider: { '@type': 'FinancialService', name: 'Elite Funding Solutions' } };
  return <main className="bg-[#040B16] text-white"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><section className="container-page py-20"><Link href="/funding-solutions" className="text-sm font-semibold text-[#E3C77A]">← All funding solutions</Link><h1 className="mt-6 max-w-4xl font-display text-[48px] font-semibold leading-tight md:text-[68px]">{item.title}</h1><p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#B9C2D0]">{item.summary}</p><div className="mt-8 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#07111F] p-6"><p className="text-sm uppercase tracking-[0.16em] text-[#C9A45C]">Typical funding range</p><p className="mt-2 text-3xl font-semibold">{item.range}</p></div><div className="rounded-2xl border border-white/10 bg-[#07111F] p-6"><p className="text-sm uppercase tracking-[0.16em] text-[#C9A45C]">Estimated speed</p><p className="mt-2 text-3xl font-semibold">{item.speed}</p></div></div></section><section className="container-page grid gap-6 pb-20 lg:grid-cols-3"><Info title="Common use cases" items={item.useCases} /><Info title="Qualification notes" items={item.qualifications} /><Info title="Required documents" items={item.documents} /></section><section className="container-page pb-20"><div className="rounded-[28px] border border-[#C9A45C]/20 bg-[#101D2F] p-8"><h2 className="font-display text-3xl font-semibold">Ready to compare options?</h2><p className="mt-2 max-w-3xl text-[#B9C2D0]">Funding availability, terms, speed, and cost vary by business profile, underwriting review, lender criteria, and documentation. Elite Funding Solutions is not a lender and does not guarantee approval.</p><Link href="/apply" className="mt-6 inline-flex rounded-sm bg-[#C9A45C] px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#07111F]">Start secure application</Link></div></section></main>;
}
function Info({ title, items }: { title: string; items: string[] }) { return <div className="rounded-2xl border border-white/10 bg-[#07111F] p-6"><h2 className="font-display text-2xl font-semibold text-[#E3C77A]">{title}</h2><ul className="mt-4 space-y-3 text-[#B9C2D0]">{items.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#C9A45C]" />{item}</li>)}</ul></div>; }
