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
  Truck,
  Utensils,
  Users,
  Warehouse,
  Wrench,
  Zap,
} from 'lucide-react';

const trustBadges = [
  { icon: Zap, label: '24-72 Hrs', sublabel: 'Complete-file review' },
  { icon: LineChart, label: '$10K-$5M', sublabel: 'Program Range' },
  { icon: ShieldCheck, label: 'Secure', sublabel: 'Application Intake' },
  { icon: LockKeyhole, label: 'Advisor', sublabel: 'Led Review' },
];

const fitSignals = [
  { icon: ShieldCheck, title: 'No sensitive docs up front', text: 'Start with revenue, timing, requested amount, and use of funds before submitting SSN or bank statements.' },
  { icon: Users, title: 'Advisor review', text: 'A funding advisor reviews product fit and documentation needs before the complete file is packaged.' },
  { icon: Handshake, title: 'No obligation', text: 'Use the fit check to understand available direction before moving into the full secure application.' },
];

const fundingSolutions = [
  { icon: BadgeDollarSign, title: 'Merchant Cash Advance', text: 'Revenue-based funding for urgent needs with responsible cost and cash-flow review.', href: '/funding-solutions/merchant-cash-advance' },
  { icon: Building2, title: 'Working Capital', text: 'Operating capital for payroll, inventory, marketing, expansion, and timing gaps.', href: '/funding-solutions/working-capital' },
  { icon: Factory, title: 'Equipment Financing', text: 'Finance revenue-producing assets while preserving liquidity for the business.', href: '/funding-solutions/equipment-financing' },
  { icon: Landmark, title: 'SBA Loans', text: 'Longer-term options for qualified borrowers seeking structured growth capital.', href: '/funding-solutions/sba-loans' },
  { icon: CreditCard, title: 'Lines of Credit', text: 'Revolving access for recurring purchases, vendor payments, and reserve planning.', href: '/funding-solutions/business-lines-of-credit' },
  { icon: ReceiptText, title: 'Invoice Factoring', text: 'Turn eligible B2B receivables into working capital with clear advance terms.', href: '/funding-solutions/invoice-factoring' },
  { icon: Warehouse, title: 'Commercial Real Estate Financing', text: 'Acquisition, refinance, bridge, and owner-occupied property strategies.', href: '/funding-solutions/commercial-real-estate' },
];

const processSteps = [
  { step: '1', title: 'Submit Your Application', text: 'Share business, owner, revenue, and bank statement details through a secure intake.' },
  { step: '2', title: 'Review Tailored Offers', text: 'Your advisor packages the file and explains available terms and tradeoffs.' },
  { step: '3', title: 'Move Forward Clearly', text: 'Compare cost, speed, repayment mechanics, and documents before selecting an option.' },
];

const whyElite = [
  { icon: Banknote, label: 'Broad Funding Marketplace' },
  { icon: Users, label: 'Dedicated Funding Advisors' },
  { icon: BriefcaseBusiness, label: 'Customized Financing Strategies' },
  { icon: Clock3, label: 'Fast Turnaround' },
  { icon: CheckCircle2, label: 'Transparent Process' },
  { icon: ShieldCheck, label: 'White-Glove Service' },
];

const industries = [
  {
    icon: Building2,
    title: 'Construction & Trades',
    slug: 'construction-trades',
    needs: 'Funding needs: Materials, payroll, mobilization, equipment, and project gaps.',
    useCase: 'Use cases: Bridge receivables, start larger jobs, purchase tools, or cover labor before progress payments arrive.',
  },
  {
    icon: HeartPulse,
    title: 'Healthcare Practices',
    slug: 'healthcare-practices',
    needs: 'Funding needs: Equipment, staffing, insurance gaps, expansion, and working capital.',
    useCase: 'Use cases: Upgrade technology, open new treatment rooms, manage payroll, or cover delayed reimbursements.',
  },
  {
    icon: Utensils,
    title: 'Restaurants & Hospitality',
    slug: 'restaurants-hospitality',
    needs: 'Funding needs: Inventory, renovations, seasonal cash flow, payroll, and marketing.',
    useCase: 'Use cases: Refresh the dining room, add outdoor seating, purchase inventory, or stabilize cash flow during slower months.',
  },
  {
    icon: Truck,
    title: 'Trucking & Logistics',
    slug: 'trucking-logistics',
    needs: 'Funding needs: Repairs, fuel, insurance, fleet growth, and factoring support.',
    useCase: 'Use cases: Repair trucks quickly, cover fuel costs, add vehicles, or manage delayed shipper payments.',
  },
  {
    icon: ShoppingBag,
    title: 'Retail & E-commerce',
    slug: 'retail-ecommerce',
    needs: 'Funding needs: Inventory, ads, fulfillment, vendor payments, and seasonal buying.',
    useCase: 'Use cases: Stock up before peak season, launch campaigns, pay suppliers, or expand product lines.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Professional Services',
    slug: 'professional-services',
    needs: 'Funding needs: Hiring, software, marketing, office buildout, and operating reserves.',
    useCase: 'Use cases: Add staff, fund growth campaigns, upgrade systems, or smooth cash flow between client payments.',
  },
  {
    icon: Factory,
    title: 'Manufacturing & Wholesale',
    slug: 'manufacturing-wholesale',
    needs: 'Funding needs: Raw materials, purchase orders, equipment, and supplier payments.',
    useCase: 'Use cases: Accept larger orders, buy materials upfront, manage production cycles, or expand capacity.',
  },
  {
    icon: Wrench,
    title: 'Automotive & Repair',
    slug: 'automotive-repair',
    needs: 'Funding needs: Parts, tools, lifts, payroll, and shop expansion.',
    useCase: 'Use cases: Purchase diagnostic equipment, stock parts, add technicians, or renovate service bays.',
  },
];

const faqs = [
  ['How much funding can I get?', 'Qualified businesses can access $10,000 to $5,000,000 depending on revenue, time in business, credit profile, industry, and selected funding product.'],
  ['What types of businesses do you fund?', 'We support established U.S. businesses across construction, healthcare, restaurants, trucking, retail, professional services, and many additional industries.'],
  ['How fast can I receive funding?', 'Many reviews are returned within 24 to 72 hours after a complete application and supporting documentation are received. Timing and available options vary by profile.'],
  ['Is there an obligation to accept an offer?', 'No. Pre-qualification is designed to show available options, and you are never obligated to accept an offer.'],
  ['What credit score do I need?', 'Programs may be available for owners with 625+ credit, subject to revenue, deposits, business history, and funder underwriting requirements.'],
  ['How does your pre-qualification process work?', 'Submit a short application, review curated options with a funding advisor, select terms that fit, then complete documentation for funding.'],
];

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-7 max-w-3xl text-center md:mb-9">
      {eyebrow && <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.34em] text-[#d6af62]">{eyebrow}</p>}
      <h2 className="font-serif text-[28px] font-medium uppercase tracking-[0.16em] text-white md:text-[34px]">{title}</h2>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400 md:text-base">{subtitle}</p>}
    </div>
  );
}

function FundingReviewDesk() {
  const metrics = [
    ['Program Range', '$10K-$5M'],
    ['Review Window', '24-72 hrs'],
    ['File Status', 'Secure Intake'],
    ['Advisor Review', 'Included'],
  ];
  const rows = [
    ['Business Profile', 'Reviewed'],
    ['Revenue Trends', 'In Progress'],
    ['Bank Statements', 'Secure Upload'],
    ['Offer Comparison', 'Advisor-Led'],
  ];

  return (
    <div className="relative w-full max-w-[520px] lg:ml-auto">
      <div className="absolute -inset-5 rounded-[2rem] bg-[radial-gradient(circle_at_35%_20%,rgba(214,175,98,0.18),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(72,126,194,0.2),transparent_30%)] blur-xl" />
      <div className="relative overflow-hidden rounded-md border border-[#d6af62]/20 bg-[#06101d]/95 shadow-[0_34px_90px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="border-b border-[#d6af62]/14 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d6af62]">Funding Intelligence</p>
              <h2 className="mt-2 font-serif text-2xl text-white">Funding Review Desk</h2>
            </div>
            <div className="hidden rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200 sm:block">
              Secure Intake
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-[#d6af62]/14">
          {metrics.map(([label, value]) => (
            <div key={label} className="border-r border-t border-[#d6af62]/10 p-4 first:border-t-0 odd:border-r even:border-r-0 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-100 sm:text-base">{value}</p>
            </div>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Underwriting Summary</p>
            <LineChart className="h-5 w-5 text-[#d6af62]" strokeWidth={1.4} />
          </div>
          <div className="mb-6 h-28 rounded-sm border border-[#d6af62]/12 bg-[#030812]/70 p-4">
            <svg viewBox="0 0 420 100" className="h-full w-full" aria-hidden="true">
              <path d="M0 78 H420" stroke="rgba(255,255,255,0.08)" />
              <path d="M0 48 H420" stroke="rgba(255,255,255,0.08)" />
              <path d="M0 18 H420" stroke="rgba(255,255,255,0.08)" />
              <path d="M4 78 C60 62 78 36 128 45 C174 53 195 27 238 34 C286 42 310 18 354 24 C382 28 398 20 416 12" fill="none" stroke="#d6af62" strokeWidth="4" strokeLinecap="round" />
              <path d="M4 78 C60 62 78 36 128 45 C174 53 195 27 238 34 C286 42 310 18 354 24 C382 28 398 20 416 12 V100 H4 Z" fill="rgba(214,175,98,0.12)" />
            </svg>
          </div>
          <div className="overflow-hidden rounded-sm border border-[#d6af62]/12">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1.2fr_1fr] border-b border-[#d6af62]/10 last:border-b-0">
                <div className="px-4 py-3 text-[12px] text-slate-400">{label}</div>
                <div className="border-l border-[#d6af62]/10 px-4 py-3 text-[12px] font-semibold text-slate-100">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden border-b border-[#c7a45a]/10 bg-[#030812] pt-16 md:-mt-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,rgba(62,114,174,0.2),transparent_28%),linear-gradient(90deg,#030812_0%,#06101f_48%,#030812_100%)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(214,175,98,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(214,175,98,.06)_1px,transparent_1px)] [background-size:58px_58px]" />
      <div className="relative z-10 mx-auto grid min-h-[760px] max-w-[1280px] items-center gap-12 px-5 pb-12 pt-24 md:px-8 md:pt-32 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.92fr)] xl:px-0">
        <div>
          <p className="mb-6 text-[12px] font-semibold uppercase tracking-[0.38em] text-[#d6af62]">Fast. Flexible. Reliable.</p>
          <h1 className="max-w-[720px] font-serif text-[42px] font-medium leading-[1.08] tracking-[-0.02em] text-white sm:text-[50px] md:text-[62px] lg:text-[68px]">
            Fast, Flexible Capital for <span className="text-[#d6af62]">Serious Operators.</span>
          </h1>
          <p className="mt-7 max-w-[560px] text-base leading-8 text-slate-200 md:text-lg">
            Access working capital from $10,000 to $5,000,000 through a secure, advisor-led process that helps you compare qualified funding structures without hype or pressure.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link href="/funding-fit-check" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm bg-gradient-to-r from-[#b8893f] via-[#f2d17e] to-[#b8893f] px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#050912] shadow-[0_12px_32px_rgba(214,175,98,0.24)] transition hover:brightness-110">
              Start Funding Fit Check <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/apply" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm border border-[#d6af62]/55 bg-[#06101f]/60 px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:border-[#d6af62] hover:bg-[#d6af62]/10">
              Full Secure Application <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-11 grid max-w-[620px] grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0">
            {trustBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.label} className="border-[#d6af62]/18 sm:border-r sm:px-6 first:pl-0 last:border-r-0">
                  <Icon className="mb-3 h-7 w-7 text-[#d6af62]" strokeWidth={1.4} />
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white">{badge.label}</p>
                  <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">{badge.sublabel}</p>
                </div>
              );
            })}
          </div>
        </div>
        <FundingReviewDesk />
      </div>
    </section>
  );
}

function FitCheckSection() {
  return (
    <section className="border-b border-[#c7a45a]/10 bg-[#06101d] px-5 py-9 md:px-8 xl:px-0">
      <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6af62]">Better first step</p>
          <h2 className="font-serif text-3xl leading-tight text-white md:text-4xl">Not ready to submit a full funding file?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
            Start with a light funding fit check. Share the basics, get advisor direction, then decide whether the full secure application is worth completing.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/funding-fit-check" className="group inline-flex h-12 items-center justify-center gap-3 rounded-sm bg-[#d6af62] px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-[#050912] transition hover:bg-[#f2d17e]">
              Request fit check <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-sm border border-[#d6af62]/45 px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:border-[#d6af62]">
              Talk to advisor
            </Link>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {fitSignals.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-sm border border-[#d6af62]/16 bg-[#081523] p-5">
                <Icon className="mb-4 h-7 w-7 text-[#d6af62]" strokeWidth={1.4} />
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FundingSolutions() {
  return (
    <section className="bg-[#030812] px-5 py-10 md:px-8 xl:px-0">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading title="Funding Solutions" subtitle="Flexible financing solutions designed to help your business grow, stabilize cash flow, and scale responsibly." />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {fundingSolutions.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="group min-h-[236px] rounded-sm border border-[#d6af62]/16 bg-[#081523]/88 p-6 transition hover:-translate-y-1 hover:border-[#d6af62]/45 hover:bg-[#0b1a2b]">
                <Icon className="mb-5 h-10 w-10 text-[#d6af62]" strokeWidth={1.25} />
                <h3 className="font-serif text-xl leading-tight text-white">{item.title}</h3>
                <p className="mt-3 text-[13px] leading-6 text-slate-400">{item.text}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#d6af62]">Learn More <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowAndWhy() {
  return (
    <section className="border-y border-[#c7a45a]/10 bg-[#05101d] px-5 py-8 md:px-8 xl:px-0">
      <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[1fr_1.28fr] lg:gap-14">
        <div>
          <h2 className="mb-10 text-center font-serif text-2xl font-medium uppercase tracking-[0.18em] text-white">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {processSteps.map((step, index) => (
              <div key={step.step} className="relative text-center">
                {index < processSteps.length - 1 && <span className="absolute left-[58%] top-6 hidden h-px w-[84%] bg-[#d6af62]/25 sm:block" />}
                <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#d6af62] bg-[#071322] font-serif text-xl text-[#f1d08a]">{step.step}</div>
                <h3 className="font-serif text-xl text-white">{step.title}</h3>
                <p className="mx-auto mt-3 max-w-[170px] text-xs leading-6 text-slate-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-[#d6af62]/25 lg:border-l lg:pl-14">
          <h2 className="mb-7 text-center font-serif text-2xl font-medium uppercase tracking-[0.18em] text-[#d6af62]">Why Choose Elite</h2>
          <div className="grid grid-cols-2 border border-[#d6af62]/10 md:grid-cols-3">
            {whyElite.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="min-h-[128px] border-b border-r border-[#d6af62]/10 p-5 text-center [&:nth-child(3n)]:md:border-r-0 [&:nth-child(even)]:border-r-0 [&:nth-child(even)]:md:border-r">
                  <Icon className="mx-auto mb-3 h-8 w-8 text-[#d6af62]" strokeWidth={1.25} />
                  <p className="mx-auto max-w-[150px] text-sm leading-5 text-white">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="bg-[#030812] px-5 py-9 md:px-8 xl:px-0">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading title="Industries We Serve" subtitle="Industry-specific funding reviews for operators with real cash-flow timing needs." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {industries.map((industry) => {
            const Icon = industry.icon;
            return (
              <Link
                key={industry.title}
                href={`/industries#${industry.slug}`}
                className="group flex min-h-[312px] flex-col rounded-sm border border-[#d6af62]/16 bg-[#081523]/90 p-6 transition hover:-translate-y-1 hover:border-[#d6af62]/45 hover:bg-[#0b1a2b] hover:shadow-[0_18px_55px_rgba(0,0,0,0.24)]"
              >
                <div className="mb-5 h-1 w-16 bg-[#d6af62]" />
                <Icon className="mb-5 h-9 w-9 text-[#d6af62]" strokeWidth={1.25} />
                <h3 className="font-serif text-xl leading-tight text-white">{industry.title}</h3>
                <p className="mt-4 text-[13px] leading-6 text-slate-300">{industry.needs}</p>
                <p className="mt-3 text-[13px] leading-6 text-slate-400">{industry.useCase}</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d6af62]">
                  Explore funding options <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [openItems, setOpenItems] = useState<number[]>([0]);
  const toggle = (index: number) => setOpenItems((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]));

  return (
    <section className="bg-[#030812] px-5 py-9 md:px-8 xl:px-0">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading title="Frequently Asked Questions" />
        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map(([question, answer], index) => {
            const isOpen = openItems.includes(index);
            return (
              <div key={question} className="rounded-sm border border-[#d6af62]/14 bg-[#071322]">
                <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white" onClick={() => toggle(index)} aria-expanded={isOpen}>
                  {question}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-[#d6af62] transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="border-t border-[#d6af62]/10 px-5 pb-5 pt-1 text-sm leading-6 text-slate-400">{answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-[#030812] px-5 pb-9 md:px-8 xl:px-0">
      <div className="mx-auto grid max-w-[1280px] overflow-hidden rounded-sm border border-[#d6af62]/18 bg-[#071322] shadow-[0_20px_60px_rgba(0,0,0,0.26)] md:grid-cols-[1fr_auto] md:items-center">
        <div className="px-7 py-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6af62]">Secure Intake</p>
          <h2 className="font-serif text-3xl leading-tight text-white md:text-4xl">Ready to Secure the Capital Your Business Needs?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Start with a funding fit check or submit a complete secure file when you are ready. Available options vary by profile; terms are subject to underwriting and partner review.</p>
        </div>
        <div className="px-7 pb-8 md:pb-0">
          <Link href="/funding-fit-check" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm bg-gradient-to-r from-[#b8893f] via-[#f2d17e] to-[#b8893f] px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#050912] shadow-[0_12px_32px_rgba(214,175,98,0.24)] transition hover:brightness-110">
            Start Fit Check <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#030812] text-white">
      <Hero />
      <FitCheckSection />
      <FundingSolutions />
      <HowAndWhy />
      <Industries />
      <Faq />
      <FinalCta />
      <style jsx global>{`
        .font-serif { font-family: Georgia, 'Times New Roman', serif; }
      `}</style>
    </div>
  );
}
