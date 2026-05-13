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
  Star,
  Truck,
  Utensils,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react';

const trustBadges = [
  { icon: Zap, label: '24–72 Hour', sublabel: 'Complete-file review' },
  { icon: LineChart, label: '$10K–$5M', sublabel: 'Program Range' },
  { icon: ShieldCheck, label: 'Secure', sublabel: 'Application Intake' },
  { icon: LockKeyhole, label: 'No', sublabel: 'Obligation' },
];

const stats = [
  { icon: BadgeDollarSign, value: '$10K–$5M', label: 'Program Range' },
  { icon: Users, value: 'U.S.', label: 'Partner Coverage' },
  { icon: Star, value: '1 File', label: 'Packaged Review' },
  { icon: Handshake, value: 'Advisor-Led', label: 'Offer Comparison' },
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
  { icon: Building2, title: 'Construction', className: 'industry-construction' },
  { icon: HeartPulse, title: 'Healthcare', className: 'industry-healthcare' },
  { icon: Utensils, title: 'Restaurants', className: 'industry-restaurants' },
  { icon: Truck, title: 'Trucking', className: 'industry-trucking' },
  { icon: ShoppingBag, title: 'Retail', className: 'industry-retail' },
  { icon: BriefcaseBusiness, title: 'Professional Services', className: 'industry-professional' },
];

const testimonials = [
  {
    quote: 'Elite Funding Solutions provided the capital we needed to expand our operations seamlessly. Their speed and transparency are unmatched.',
    byline: 'Business Owner',
    company: 'Construction Company',
  },
  {
    quote: 'The team was professional, knowledgeable, and delivered funding faster than we expected. Highly recommend!',
    byline: 'CEO',
    company: 'Healthcare Provider',
  },
  {
    quote: 'Elite helped us maintain cash flow and take advantage of major growth opportunities. A true partner.',
    byline: 'Founder',
    company: 'Logistics Company',
  },
];

const faqs = [
  ['How much funding can I get?', 'Qualified businesses can access $10,000 to $5,000,000 depending on revenue, time in business, credit profile, industry, and selected funding product.'],
  ['What types of businesses do you fund?', 'We support established U.S. businesses across construction, healthcare, restaurants, trucking, retail, professional services, and many additional industries.'],
  ['How fast can I receive funding?', 'Many approvals are returned within 24 to 72 hours after a complete application and supporting documentation are received.'],
  ['Is there an obligation to accept an offer?', 'No. Pre-qualification is designed to show available options, and you are never obligated to accept an offer.'],
  ['What credit score do I need?', 'Programs may be available for owners with 625+ credit, subject to revenue, deposits, business history, and lender underwriting requirements.'],
  ['How does your pre-qualification process work?', 'Submit a short application, review curated offers with a funding advisor, select terms that fit, then complete documentation for funding.'],
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

function HeroVisual() {
  return (
    <div className="hero-visual pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] overflow-hidden lg:block">
      <div className="city-glow" />
      <div className="skyline">
        {Array.from({ length: 31 }).map((_, index) => (
          <span key={index} className={`tower tower-${(index % 10) + 1}`} />
        ))}
      </div>
      <div className="desk-lamp" />
      <div className="laptop">
        <div className="laptop-screen">
          <div className="screen-top"><span>EliteOS</span><span>Secured</span></div>
          <div className="screen-grid">
            <div><small>Revenue</small><strong>$1,250,000</strong></div>
            <div><small>Cash Flow</small><strong>$680,000</strong></div>
            <div><small>Utilization</small><strong>62%</strong></div>
          </div>
          <div className="chart-bars">{Array.from({ length: 11 }).map((_, i) => <i key={i} style={{ height: `${22 + ((i * 13) % 50)}%` }} />)}</div>
          <svg className="chart-line" viewBox="0 0 220 70" aria-hidden="true"><path d="M4 58 C35 20 58 42 84 32 S128 18 158 30 S192 46 216 10" /></svg>
        </div>
        <div className="laptop-base" />
      </div>
      <div className="notebook" />
      <div className="coffee-cup">ELITE</div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden border-b border-[#c7a45a]/10 bg-[#030812] pt-16 md:-mt-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,rgba(62,114,174,0.34),transparent_28%),linear-gradient(90deg,#030812_0%,#06101f_44%,rgba(3,8,18,0.58)_100%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(214,175,98,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(214,175,98,.06)_1px,transparent_1px)] [background-size:58px_58px]" />
      <HeroVisual />
      <div className="relative z-10 mx-auto flex min-h-[720px] max-w-[1280px] flex-col px-5 pb-12 pt-24 sm:min-h-[760px] md:px-8 md:pt-32 lg:min-h-[760px] xl:px-0">
        <div className="max-w-[610px]">
          <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.44em] text-[#d6af62]">Fast. Flexible. Reliable.</p>
          <h1 className="font-serif text-[42px] font-medium leading-[1.08] tracking-[-0.035em] text-white sm:text-[50px] md:text-[64px] lg:text-[68px] xl:text-[72px]">
            Fast, Flexible Capital for <span className="text-[#d6af62]">Serious Operators.</span>
          </h1>
          <p className="mt-7 max-w-[510px] text-base leading-8 text-slate-200 md:text-lg">
            Access working capital from $10,000 to $5,000,000 through a secure, advisor-led process that helps you compare qualified funding structures without hype or pressure.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link href="/apply" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm bg-gradient-to-r from-[#b8893f] via-[#f2d17e] to-[#b8893f] px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#050912] shadow-[0_12px_32px_rgba(214,175,98,0.24)] transition hover:brightness-110">
              Get Pre-Qualified <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/contact" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm border border-[#d6af62]/55 bg-[#06101f]/60 px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:border-[#d6af62] hover:bg-[#d6af62]/10">
              Speak With an Advisor <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <div className="mt-11 grid max-w-[560px] grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0">
          {trustBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className="border-[#d6af62]/18 sm:border-r sm:px-7 first:pl-0 last:border-r-0">
                <Icon className="mb-3 h-7 w-7 text-[#d6af62]" strokeWidth={1.4} />
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white">{badge.label}</p>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">{badge.sublabel}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-12">
          <div className="grid overflow-hidden rounded-md border border-[#d6af62]/18 bg-[#071322]/80 shadow-[0_20px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-5 border-b border-r border-[#d6af62]/12 px-7 py-6 last:border-r-0 sm:even:border-r-0 lg:even:border-r lg:border-b-0 lg:last:border-r-0">
                  <Icon className="h-10 w-10 shrink-0 text-[#d6af62]" strokeWidth={1.3} />
                  <div>
                    <p className="font-serif text-3xl leading-none text-[#f1d08a]">{stat.value}</p>
                    <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
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
        <SectionHeading title="Industries We Serve" subtitle="Tailored financing solutions for businesses across every industry." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {industries.map((industry) => {
            const Icon = industry.icon;
            return (
              <Link key={industry.title} href={`/industries#${industry.title.toLowerCase().replaceAll(' ', '-')}`} className="group overflow-hidden rounded-sm border border-[#d6af62]/16 bg-[#081523]">
                <div className={`industry-image ${industry.className}`} />
                <div className="flex min-h-[62px] items-center gap-3 px-5 py-3">
                  <Icon className="h-6 w-6 text-[#d6af62]" strokeWidth={1.25} />
                  <span className="font-serif text-base text-white">{industry.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="border-y border-[#c7a45a]/10 bg-[#05101d] px-5 py-9 md:px-8 xl:px-0">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading title="What Our Clients Say" />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.company} className="relative rounded-sm border border-[#d6af62]/16 bg-[#081523]/85 p-7 shadow-[0_16px_50px_rgba(0,0,0,0.22)]">
              <div className="mb-5 flex gap-1 text-[#f1d08a]">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
              <Sparkles className="absolute right-7 top-7 h-8 w-8 text-white/10" />
              <p className="text-sm leading-7 text-slate-200">“{testimonial.quote}”</p>
              <p className="mt-6 text-sm text-white">— {testimonial.byline}</p>
              <p className="text-sm text-slate-400">{testimonial.company}</p>
            </article>
          ))}
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
      <div className="mx-auto grid max-w-[1280px] overflow-hidden rounded-sm border border-[#d6af62]/18 bg-[#071322] shadow-[0_20px_60px_rgba(0,0,0,0.26)] md:grid-cols-[320px_1fr_auto] md:items-center">
        <div className="mini-skyline h-40 md:h-full" />
        <div className="px-7 py-8">
          <h2 className="font-serif text-3xl leading-tight text-white md:text-4xl">Ready to Secure the Capital<br className="hidden md:block" /> Your Business Needs?</h2>
          <p className="mt-3 text-sm text-slate-400">Submit one secure file and review available funding structures with an advisor. No guaranteed approval claims; terms are subject to underwriting and partner approval.</p>
        </div>
        <div className="px-7 pb-8 md:pb-0">
          <Link href="/apply" className="group inline-flex h-14 items-center justify-center gap-3 rounded-sm bg-gradient-to-r from-[#b8893f] via-[#f2d17e] to-[#b8893f] px-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#050912] shadow-[0_12px_32px_rgba(214,175,98,0.24)] transition hover:brightness-110">
            Get Pre-Qualified Today <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
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
      <FundingSolutions />
      <HowAndWhy />
      <Industries />
      <Testimonials />
      <Faq />
      <FinalCta />
      <style jsx global>{`
        .font-serif { font-family: Georgia, 'Times New Roman', serif; }
        .hero-visual:before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #030812 0%, rgba(3,8,18,.38) 24%, rgba(3,8,18,.06) 58%, #030812 100%); z-index: 8; }
        .city-glow { position: absolute; inset: 0; background: radial-gradient(circle at 62% 38%, rgba(83,148,221,.34), transparent 19%), radial-gradient(circle at 82% 32%, rgba(214,175,98,.11), transparent 22%); }
        .skyline { position: absolute; left: 7%; right: 0; top: 17%; height: 270px; display: flex; align-items: end; gap: 9px; opacity: .88; }
        .tower { position: relative; width: 20px; border: 1px solid rgba(255,255,255,.06); background: linear-gradient(180deg, rgba(26,45,75,.95), rgba(4,10,20,.96)); box-shadow: inset 0 0 18px rgba(54,112,187,.18), 0 0 24px rgba(92,151,218,.16); }
        .tower:after { content: ''; position: absolute; inset: 8px 4px; background-image: radial-gradient(circle, rgba(241,208,138,.85) 0 1px, transparent 1.8px); background-size: 9px 13px; opacity: .65; }
        .tower-1 { height: 130px; } .tower-2 { height: 188px; width: 25px; } .tower-3 { height: 235px; width: 18px; } .tower-4 { height: 160px; } .tower-5 { height: 270px; width: 28px; } .tower-6 { height: 210px; } .tower-7 { height: 145px; width: 30px; } .tower-8 { height: 246px; } .tower-9 { height: 178px; } .tower-10 { height: 218px; width: 24px; }
        .laptop { position: absolute; right: 21%; top: 37%; z-index: 12; width: 350px; perspective: 700px; transform: rotate(-1deg); }
        .laptop-screen { height: 220px; border: 3px solid #171d29; border-radius: 14px 14px 4px 4px; background: linear-gradient(135deg, #07101f, #0e1b30); box-shadow: 0 32px 65px rgba(0,0,0,.68), inset 0 0 0 1px rgba(214,175,98,.12); padding: 20px; }
        .screen-top { display: flex; justify-content: space-between; color: #d6af62; font-size: 8px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 18px; }
        .screen-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; color: white; font-size: 11px; }
        .screen-grid div { border: 1px solid rgba(214,175,98,.14); background: rgba(255,255,255,.03); padding: 9px; } .screen-grid small { display: block; color: #7d8ba1; font-size: 7px; } .screen-grid strong { color: #fff; }
        .chart-bars { position: absolute; left: 21px; bottom: 25px; display: flex; align-items: end; gap: 5px; width: 120px; height: 58px; } .chart-bars i { width: 7px; background: linear-gradient(#55a6ff,#1f4f96); border-radius: 2px 2px 0 0; }
        .chart-line { position: absolute; right: 22px; bottom: 25px; width: 148px; height: 70px; } .chart-line path { fill: none; stroke: #d6af62; stroke-width: 4; stroke-linecap: round; filter: drop-shadow(0 0 5px rgba(214,175,98,.45)); }
        .laptop-base { height: 16px; margin: 0 -28px; border-radius: 3px 3px 18px 18px; background: linear-gradient(180deg,#343944,#0f1118); box-shadow: 0 18px 42px rgba(0,0,0,.55); }
        .notebook { position: absolute; right: 43%; bottom: 15%; z-index: 11; width: 270px; height: 145px; transform: rotate(13deg) skewX(-8deg); border: 1px solid rgba(214,175,98,.28); background: linear-gradient(135deg,#101722,#060b12); box-shadow: 0 22px 48px rgba(0,0,0,.55); }
        .notebook:after { content: 'ELITE'; position: absolute; left: 90px; top: 62px; color: rgba(214,175,98,.7); font-family: Georgia,serif; letter-spacing: .4em; font-size: 15px; }
        .coffee-cup { position: absolute; right: 7%; bottom: 17%; z-index: 13; width: 86px; height: 116px; border-radius: 6px 6px 18px 18px; border: 1px solid rgba(214,175,98,.3); background: linear-gradient(90deg,#05070b,#111722,#05070b); display: grid; place-items: center; color: #d6af62; font-family: Georgia,serif; font-size: 12px; letter-spacing: .25em; box-shadow: 0 18px 40px rgba(0,0,0,.55); }
        .desk-lamp { position: absolute; right: 5%; top: 14%; z-index: 13; width: 150px; height: 150px; border-top: 5px solid #d6af62; border-right: 5px solid #d6af62; transform: rotate(-28deg); filter: drop-shadow(0 0 20px rgba(214,175,98,.18)); }
        .desk-lamp:after { content: ''; position: absolute; right: -16px; top: 124px; width: 82px; height: 45px; background: linear-gradient(90deg,#111722,#f3dda4); clip-path: polygon(0 0,100% 20%,82% 100%,8% 75%); box-shadow: 0 0 40px rgba(241,208,138,.55); }
        .industry-image { height: 112px; position: relative; overflow: hidden; background-size: cover; background-position: center; }
        .industry-image:after, .mini-skyline:after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(3,8,18,0),rgba(3,8,18,.7)); }
        .industry-construction { background-image: linear-gradient(135deg, rgba(214,175,98,.2), rgba(4,12,22,.2)), repeating-linear-gradient(90deg, transparent 0 24px, rgba(214,175,98,.45) 25px 28px), linear-gradient(160deg,#22304a,#0a1626); }
        .industry-healthcare { background-image: linear-gradient(135deg, rgba(83,148,221,.35), rgba(4,12,22,.2)), repeating-linear-gradient(0deg, transparent 0 18px, rgba(255,255,255,.13) 19px 21px), linear-gradient(160deg,#1b3148,#071322); }
        .industry-restaurants { background-image: radial-gradient(circle at 50% 32%, rgba(241,208,138,.42), transparent 18%), repeating-linear-gradient(90deg, rgba(214,175,98,.14) 0 12px, transparent 13px 34px), linear-gradient(160deg,#362013,#071322); }
        .industry-trucking { background-image: linear-gradient(180deg, transparent 45%, rgba(241,208,138,.22) 46% 48%, transparent 49%), linear-gradient(135deg,#24384f,#071322); }
        .industry-retail { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 20px, transparent 21px 44px), linear-gradient(135deg,#2a241b,#071322); }
        .industry-professional { background-image: radial-gradient(circle at 22% 30%, rgba(255,255,255,.18), transparent 10%), radial-gradient(circle at 70% 34%, rgba(214,175,98,.22), transparent 12%), linear-gradient(135deg,#17263b,#071322); }
        .mini-skyline { position: relative; background: radial-gradient(circle at 55% 45%, rgba(83,148,221,.28), transparent 28%), linear-gradient(160deg,#091c31,#030812); }
        .mini-skyline:before { content: ''; position: absolute; left: 8%; right: 8%; bottom: 20%; height: 65%; background: repeating-linear-gradient(90deg, rgba(19,37,62,.95) 0 19px, transparent 20px 28px, rgba(19,37,62,.9) 29px 52px, transparent 53px 68px); clip-path: polygon(0 100%,0 48%,6% 48%,6% 32%,13% 32%,13% 55%,19% 55%,19% 20%,26% 20%,26% 42%,35% 42%,35% 6%,43% 6%,43% 35%,52% 35%,52% 17%,60% 17%,60% 50%,70% 50%,70% 28%,80% 28%,80% 44%,90% 44%,90% 22%,100% 22%,100% 100%); }
        @media (max-width: 1023px) { .hero-visual { display: block; opacity: .38; width: 100%; } .hero-visual:before { background: linear-gradient(90deg,#030812 0%,rgba(3,8,18,.7) 45%,#030812 100%); } .laptop,.notebook,.coffee-cup,.desk-lamp { display:none; } .skyline { left: 5%; top: 20%; } }
      `}</style>
    </div>
  );
}
