'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Factory,
  Handshake,
  HeartPulse,
  Landmark,
  LineChart,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Utensils,
  Users,
  Warehouse,
} from 'lucide-react';

const trustBadges = [
  { icon: LineChart, label: '$10K–$5M', sublabel: 'program range' },
  { icon: Clock3, label: '24–72 hr', sublabel: 'complete-file review' },
  { icon: ShieldCheck, label: 'Secure', sublabel: 'application intake' },
  { icon: LockKeyhole, label: 'No obligation', sublabel: 'to accept an offer' },
];

const metrics = [
  { value: '$10K–$5M', label: 'Working-capital and growth programs' },
  { value: 'U.S.', label: 'Nationwide funding partner coverage' },
  { value: '1 file', label: 'Advisor-packaged application workflow' },
];

const fundingSolutions = [
  { icon: BadgeDollarSign, title: 'Merchant Cash Advance', text: 'Revenue-based funding for urgent needs with responsible cost and cash-flow review.', href: '/funding-solutions/merchant-cash-advance' },
  { icon: Building2, title: 'Working Capital', text: 'Operating capital for payroll, inventory, marketing, expansion, and timing gaps.', href: '/funding-solutions/working-capital' },
  { icon: Factory, title: 'Equipment Financing', text: 'Finance revenue-producing assets while preserving liquidity for the business.', href: '/funding-solutions/equipment-financing' },
  { icon: CreditCard, title: 'Business Lines of Credit', text: 'Revolving access for recurring purchases, vendor payments, and reserve planning.', href: '/funding-solutions/business-lines-of-credit' },
  { icon: ReceiptText, title: 'Invoice Factoring', text: 'Turn eligible B2B receivables into working capital with clear advance terms.', href: '/funding-solutions/invoice-factoring' },
  { icon: Landmark, title: 'SBA Loans', text: 'Longer-term options for qualified borrowers seeking structured growth capital.', href: '/funding-solutions/sba-loans' },
  { icon: Warehouse, title: 'Commercial Real Estate', text: 'Acquisition, refinance, bridge, and owner-occupied property strategies.', href: '/funding-solutions/commercial-real-estate' },
];

const processSteps = [
  { step: '01', title: 'Submit a secure funding file', text: 'Share business, owner, revenue, and bank statement details in one guided application.' },
  { step: '02', title: 'Review qualified structures', text: 'Your advisor packages the file, coordinates partner review, and explains available terms.' },
  { step: '03', title: 'Move forward with clarity', text: 'Compare cost, speed, repayment mechanics, and documentation before selecting an option.' },
];

const industries = [
  { icon: Building2, title: 'Construction', slug: 'construction' },
  { icon: HeartPulse, title: 'Healthcare', slug: 'healthcare' },
  { icon: Utensils, title: 'Restaurants', slug: 'restaurants' },
  { icon: Truck, title: 'Trucking & Logistics', slug: 'trucking-logistics' },
  { icon: ShoppingBag, title: 'Retail', slug: 'retail' },
  { icon: BriefcaseBusiness, title: 'Professional Services', slug: 'professional-services' },
];

const whyElite = [
  { icon: Banknote, label: 'Broad funding marketplace', text: 'Programs across working capital, equipment, lines of credit, receivables, SBA, and real estate.' },
  { icon: Users, label: 'Dedicated funding advisors', text: 'Human guidance to organize documents, explain tradeoffs, and reduce underwriting friction.' },
  { icon: ShieldCheck, label: 'Secure document workflow', text: 'Sensitive EIN, SSN, and bank statement details are submitted through a protected intake process.' },
  { icon: Handshake, label: 'Transparent offer review', text: 'No guaranteed approvals or pressure tactics—just clear comparisons and next steps.' },
];

const faqs = [
  ['How much funding can I request?', 'Qualified businesses may request $10,000 to $5,000,000 depending on revenue, time in business, credit profile, industry, collateral, and the selected product.'],
  ['How fast can funding happen?', 'Some working-capital programs can be reviewed within 24–72 hours after a complete file is received. SBA, equipment, and commercial real estate requests generally require more underwriting time.'],
  ['Will I be obligated to accept an offer?', 'No. The process is designed to help you compare available options. You decide whether any structure fits your business objective.'],
  ['What documents should I prepare?', 'Most requests start with a completed application, owner identification, and the last three business bank statements. Product-specific requests may require invoices, equipment quotes, tax returns, or property documents.'],
];

function SectionHeading({ eyebrow, title, subtitle, light = false }: { eyebrow?: string; title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className={`text-3xl font-semibold tracking-tight md:text-5xl ${light ? 'text-white' : 'text-[#0A1628]'}`}>{title}</h2>
      {subtitle && <p className={`mt-4 text-base leading-8 md:text-lg ${light ? 'text-slate-300' : 'text-[#5A6A85]'}`}>{subtitle}</p>}
    </div>
  );
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="overflow-hidden bg-[#F8F9FB]">
      <section className="relative bg-[#061326] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(201,168,76,0.16),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(90,106,133,0.24),transparent_30%)]" />
        <div className="container-page relative grid min-h-[650px] items-center gap-10 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:gap-14 xl:gap-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/30 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#E9D391]">
              <Sparkles className="h-4 w-4" /> Private-credit style funding guidance
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-[64px] xl:text-[72px]">
              Fast, flexible business funding built for serious operators.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Access working capital from $10K to $5M through a secure, advisor-led process that helps you compare qualified funding structures without hype or pressure.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/apply" className="btn-gold h-13 px-7">Start secure application <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/funding-solutions" className="btn-dark-outline h-13 px-7">Compare funding options</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {trustBadges.map(({ icon: Icon, label, sublabel }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
                  <Icon className="mb-3 h-5 w-5 text-[#C9A84C]" />
                  <p className="font-semibold text-white">{label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{sublabel}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative w-full max-w-[520px] justify-self-center lg:justify-self-end">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="rounded-[24px] border border-white/10 bg-[#08182d] p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C9A84C]">Funding desk</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">One application. Multiple capital paths.</h2>
                  </div>
                  <div className="rounded-full bg-[#C9A84C] px-3 py-1 text-xs font-bold text-[#061326]">Secure</div>
                </div>
                <div className="mt-6 grid gap-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <span className="text-sm text-slate-300">{metric.label}</span>
                      <strong className="text-xl text-white">{metric.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#F8F9FB] p-5 text-[#0A1628]">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8A6A22]">Offer review lens</p>
                  <div className="mt-4 grid gap-3 text-sm text-[#5A6A85]">
                    {['Funding amount and holdback/payment fit', 'Estimated total cost and term', 'Documentation needed to close'].map((item) => (
                      <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-[#0A1628]" /> {item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 md:py-16 lg:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="How it works" title="A disciplined funding process from intake to decision." subtitle="Elite Funding Solutions brings order to a fragmented market with secure data collection, complete-file packaging, and clear offer comparison." />
          <div className="grid gap-5 md:grid-cols-3">
            {processSteps.map((step) => (
              <article key={step.step} className="premium-card p-7">
                <span className="text-sm font-bold text-[#C9A84C]">{step.step}</span>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#0A1628]">{step.title}</h3>
                <p className="mt-3 leading-7 text-[#5A6A85]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-[#F8F9FB]">
        <div className="container-page">
          <SectionHeading eyebrow="Funding solutions" title="Capital products aligned to cash-flow reality." subtitle="Compare common funding paths with an advisor who can explain timeline, documentation, repayment mechanics, and fit." />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {fundingSolutions.map(({ icon: Icon, title, text, href }) => (
              <Link key={title} href={href} className="premium-card group flex min-h-[230px] flex-col p-7 transition hover:-translate-y-1 hover:border-[#C9A84C]/60 hover:shadow-lg">
                <Icon className="h-6 w-6 text-[#C9A84C]" />
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#0A1628]">{title}</h3>
                <p className="mt-3 flex-1 leading-7 text-[#5A6A85]">{text}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0A1628]">View details <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-[#061326] text-white">
        <div className="container-page">
          <SectionHeading light eyebrow="Why Elite" title="Premium guidance without landing-page gimmicks." subtitle="We focus on fit, documentation quality, transparent comparisons, and a clean borrower experience." />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {whyElite.map(({ icon: Icon, label, text }) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
                <Icon className="h-6 w-6 text-[#C9A84C]" />
                <h3 className="mt-5 text-xl font-semibold text-white">{label}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-page">
          <SectionHeading eyebrow="Industries" title="Built for operating businesses with real-world capital needs." subtitle="From seasonal inventory to equipment upgrades and receivables timing, we help operators prepare funding requests around how their business actually runs." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map(({ icon: Icon, title, slug }) => (
              <Link key={slug} href={`/industries/${slug}`} className="group rounded-3xl border border-[#E5E7EB] bg-[#F8F9FB] p-6 transition hover:border-[#C9A84C]/70 hover:bg-white hover:shadow-md">
                <Icon className="h-6 w-6 text-[#C9A84C]" />
                <div className="mt-8 flex items-end justify-between gap-5">
                  <h3 className="text-2xl font-semibold tracking-tight text-[#0A1628]">{title}</h3>
                  <ArrowRight className="h-5 w-5 text-[#0A1628] transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-[#F8F9FB]">
        <div className="container-page grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="eyebrow mb-3">FAQ</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0A1628] md:text-5xl">Clear answers before you apply.</h2>
            <p className="mt-4 leading-8 text-[#5A6A85]">Responsible funding starts with realistic expectations. These answers are designed to reduce surprises and improve application quality.</p>
          </div>
          <div className="space-y-3">
            {faqs.map(([question, answer], index) => (
              <div key={question} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-6 p-5 text-left font-semibold text-[#0A1628]">
                  {question}<ChevronDown className={`h-5 w-5 shrink-0 transition ${openFaq === index ? 'rotate-180 text-[#C9A84C]' : ''}`} />
                </button>
                {openFaq === index && <p className="border-t border-[#E5E7EB] px-5 pb-5 pt-4 leading-7 text-[#5A6A85]">{answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16">
        <div className="mx-auto max-w-[1180px] rounded-[32px] bg-[#061326] p-8 text-white md:p-12 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <p className="eyebrow mb-3">Ready to compare options?</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">Submit one secure file and review available funding structures with an advisor.</h2>
            <p className="mt-4 max-w-2xl leading-8 text-slate-300">No obligation to accept. No guaranteed approval claims. Just a more professional way to approach business funding.</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col xl:flex-row">
            <Link href="/apply" className="btn-gold whitespace-nowrap">Start application</Link>
            <Link href="/contact" className="btn-dark-outline whitespace-nowrap">Talk to an advisor</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
