import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { industries } from '@/lib/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({ title: 'Industries Served | Elite Funding Solutions', description: 'Industry-specific business funding for construction, healthcare, restaurants, trucking, retail, professional services, manufacturing, automotive, ecommerce, and commercial real estate.', path: '/industries' });

export default function IndustriesPage() {
  return (
    <main className="bg-[#030812]">
      <section className="page-hero-dark"><div className="container-page py-24 md:py-32"><p className="eyebrow mb-4">Industries</p><h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-7xl">Industry-specific funding for operators with real constraints.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">We consider seasonality, deposits, receivables, equipment needs, and cash-flow patterns to help identify capital structures that fit how your business operates.</p></div></section>
      <section className="container-page grid gap-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry) => (
          <article key={industry.slug} className="premium-card p-7">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A22]">Funding use cases</div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{industry.title}</h2>
            <p className="mt-3 leading-7 text-[#5A6A85]">Common needs include {industry.needs.slice(0, 2).join(' and ').toLowerCase()}.</p>
            <Link href={`/industries/${industry.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-[#0A1628]">Explore industry <ArrowRight className="h-4 w-4" /></Link>
          </article>
        ))}
      </section>
    </main>
  );
}
