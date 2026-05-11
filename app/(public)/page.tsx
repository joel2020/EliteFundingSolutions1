'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CircleCheck as CheckCircle2, Clock, Shield, TrendingUp, Users, Star, ChevronDown, Building2, Truck, Utensils, Heart, Wrench, ShoppingBag, Zap, ChartBar as BarChart3, FileCheck, Award } from 'lucide-react';

// ─── Hero ──────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden pt-[68px]" style={{ background: 'linear-gradient(160deg, #040B16 0%, #060F1E 40%, #0A1628 100%)', minHeight: '100vh' }}>
      {/* Ambient light effects */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 70% 40%, rgba(201,168,76,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 30% 60%, rgba(15,43,91,0.4) 0%, transparent 60%)',
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-0 relative pt-20 pb-28 lg:pt-28 lg:pb-36">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-semibold mb-8"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
              Funding decisions in as little as 4 hours
            </div>

            <h1
              className="font-bold text-white mb-6"
              style={{ fontSize: 'clamp(40px, 5.5vw, 60px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}
            >
              Fast, Flexible Capital
              <br />
              <span style={{ background: 'linear-gradient(90deg, #C9A84C 0%, #E8C96A 50%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                for Ambitious Businesses
              </span>
            </h1>

            <p className="text-[17px] leading-relaxed mb-10 max-w-[500px]" style={{ color: '#7A8FA8' }}>
              Access $10K to $5M in working capital without the bank delays. Elite Funding Solutions connects high-growth businesses with our network of 50+ elite lenders — funded in 24 to 72 hours.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 mb-12">
              <Link
                href="/apply"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[16px] h-12 px-7 transition-all duration-200 w-full sm:w-auto"
                style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628', boxShadow: '0 4px 20px rgba(201,168,76,0.35)' }}
              >
                Get Pre-Qualified
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[16px] h-12 px-7 transition-all duration-200 w-full sm:w-auto"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Speak With an Advisor
              </Link>
            </div>

            {/* Trust line */}
            <p className="text-[13px]" style={{ color: '#3A4A65' }}>
              No obligation &nbsp;&bull;&nbsp; No hard credit pull &nbsp;&bull;&nbsp; Results in minutes
            </p>
          </div>

          {/* Right: stats panel */}
          <div className="lg:pl-8">
            <div
              className="rounded-[24px] p-8 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
            >
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { value: '$2.4B+', label: 'Capital Deployed', sub: 'since inception' },
                  { value: '12,000+', label: 'Businesses Funded', sub: 'across 50+ industries' },
                  { value: '97%', label: 'Renewal Rate', sub: 'client satisfaction' },
                  { value: '4 hrs', label: 'Average Decision', sub: 'during business days' },
                ].map((stat) => (
                  <div
                    key={stat.value}
                    className="rounded-[16px] p-5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="text-[28px] font-bold tracking-tight leading-none mb-1"
                      style={{ background: 'linear-gradient(90deg, #C9A84C, #E8C96A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                    >
                      {stat.value}
                    </div>
                    <div className="text-[13px] font-semibold text-white mb-0.5">{stat.label}</div>
                    <div className="text-[11px]" style={{ color: '#3A4A65' }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Recent funded indicator */}
              <div
                className="rounded-[12px] px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#10B981] shrink-0 animate-pulse" />
                <p className="text-[13px]" style={{ color: '#7A8FA8' }}>
                  <span className="text-[#C9A84C] font-semibold">Metro Flooring Co.</span> received $180,000 — today at 2:14 PM
                </p>
              </div>
            </div>

            {/* Trust logos */}
            <div className="mt-6 flex items-center gap-6 flex-wrap">
              {['Forbes', 'Inc. 5000', 'Bloomberg', 'Fast Company'].map((l) => (
                <span key={l} className="text-[13px] font-semibold tracking-tight" style={{ color: '#2A3A55' }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #F8F9FB)' }} />
    </section>
  );
}

// ─── Trust Bar ─────────────────────────────────────────────────────────────
function TrustBar() {
  return (
    <section style={{ background: '#F8F9FB', borderTop: '1px solid #EDF0F7', borderBottom: '1px solid #EDF0F7' }} className="py-8">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-0">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] mb-6" style={{ color: '#8C9BB5' }}>
          Trusted by businesses featured in
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {['CNBC', 'Forbes', 'Inc. 5000', 'Fast Company', 'Bloomberg', 'Business Insider'].map((l) => (
            <span key={l} className="text-[15px] font-semibold tracking-tight" style={{ color: '#C0CAD9' }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Funding Products ───────────────────────────────────────────────────────
function FundingProducts() {
  const products = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Merchant Cash Advance',
      amount: 'Up to $2M',
      term: '3 to 18 months',
      description: 'Advance against future receivables. Pay back as a percentage of daily revenue — no fixed monthly payments.',
      highlights: ['Based on revenue, not credit', 'Daily or weekly remittance', 'No collateral required'],
      accent: '#C9A84C',
      accentBg: 'rgba(201,168,76,0.08)',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Working Capital Line',
      amount: 'Up to $500K',
      term: 'Revolving',
      description: 'Draw what you need, when you need it. Replenish as you pay down. Perfect for seasonal cash flow gaps.',
      highlights: ['Draw on demand', 'Pay interest only on drawn amount', 'Reusable credit line'],
      accent: '#10B981',
      accentBg: 'rgba(16,185,129,0.08)',
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: 'Equipment Financing',
      amount: 'Up to $5M',
      term: '24 to 84 months',
      description: 'Finance the equipment your business needs. The equipment itself serves as collateral — no lien on your business.',
      highlights: ['Equipment-secured only', 'Preserve working capital', 'Potential tax advantages'],
      accent: '#3B82F6',
      accentBg: 'rgba(59,130,246,0.08)',
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Invoice Factoring',
      amount: 'Up to $2M',
      term: 'Per invoice',
      description: 'Turn outstanding invoices into immediate cash. Fund up to 90% of eligible receivables within 24 hours.',
      highlights: ['Up to 90% advance rate', 'No debt on balance sheet', 'Same-day funding available'],
      accent: '#8B5CF6',
      accentBg: 'rgba(139,92,246,0.08)',
    },
  ];

  return (
    <section className="section" style={{ background: '#FFFFFF' }}>
      <div className="container-page">
        <div className="text-center mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>Funding Solutions</p>
          <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
            The right capital for every stage
          </h2>
          <p className="text-[17px] max-w-[480px] mx-auto leading-relaxed" style={{ color: '#5A6A85' }}>
            Whether you need fast working capital or long-term financing, we have a product built for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-[16px] p-7 hover:border-opacity-100 transition-all duration-200 group"
              style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 4px rgba(10,22,40,0.06)' }}
            >
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all"
                  style={{ background: p.accentBg, color: p.accent }}
                >
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-[17px]" style={{ color: '#0A1628' }}>{p.title}</h3>
                  <p className="text-[13px] mt-0.5" style={{ color: '#8C9BB5' }}>
                    {p.amount} &nbsp;&bull;&nbsp; {p.term}
                  </p>
                </div>
              </div>
              <p className="text-[14px] leading-relaxed mb-5" style={{ color: '#5A6A85' }}>{p.description}</p>
              <ul className="flex flex-col gap-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-[14px]" style={{ color: '#3A4A65' }}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#10B981' }} />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/apply"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all duration-150"
            style={{ background: '#0F2B5B', color: 'white', boxShadow: '0 2px 8px rgba(15,43,91,0.2)' }}
          >
            Check Your Eligibility
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ──────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Apply in minutes',
      description: 'Complete our secure online application. Tell us about your business, revenue, and how you plan to use the funds. No hard credit pull required.',
      time: '5 minutes',
    },
    {
      number: '02',
      title: 'Upload your documents',
      description: "Securely upload your last 3 months of bank statements, a voided check, and your driver's license. That's it for most approvals.",
      time: '10 minutes',
    },
    {
      number: '03',
      title: 'Receive your offer',
      description: 'Our underwriting team reviews your file and returns an offer within 4 hours during business days. We shop your deal across 50+ funding partners.',
      time: '4 hours',
    },
    {
      number: '04',
      title: 'Get funded',
      description: 'Review and e-sign your contract. Funds are wired directly to your business account — often the same day you sign.',
      time: '24 to 72 hours',
    },
  ];

  return (
    <section className="section" style={{ background: '#F8F9FB' }}>
      <div className="container-page">
        <div className="text-center mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>The Process</p>
          <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
            From application to funded in days
          </h2>
          <p className="text-[17px] max-w-[440px] mx-auto leading-relaxed" style={{ color: '#5A6A85' }}>
            We&apos;ve removed every unnecessary step. Most businesses get funded in under 72 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              <div
                className="bg-white rounded-[16px] p-6 relative z-10"
                style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 4px rgba(10,22,40,0.06)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[32px] font-bold tracking-tight leading-none" style={{ color: '#DDE3EF' }}>{step.number}</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1"
                    style={{ background: 'rgba(201,168,76,0.1)', color: '#9A6F1A' }}
                  >
                    <Clock className="w-3 h-3" />
                    {step.time}
                  </span>
                </div>
                <h3 className="font-semibold text-[17px] mb-2" style={{ color: '#0A1628' }}>{step.title}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: '#5A6A85' }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Eligibility ───────────────────────────────────────────────────────────
function Eligibility() {
  const requirements = [
    { label: 'Time in business', value: '6+ months', icon: <Building2 className="w-4 h-4" /> },
    { label: 'Monthly revenue', value: '$10,000+', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Credit score', value: '500+', icon: <Award className="w-4 h-4" /> },
    { label: 'Business type', value: 'Most industries', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <section className="section" style={{ background: '#FFFFFF' }}>
      <div className="container-page">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>Eligibility</p>
            <h2 className="font-bold mb-5" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
              Simple qualifications, fast approvals
            </h2>
            <p className="text-[17px] leading-relaxed mb-8" style={{ color: '#5A6A85' }}>
              We focus on your business performance, not just your credit score. If your business generates consistent revenue, you likely qualify.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {requirements.map((req) => (
                <div
                  key={req.label}
                  className="flex items-center gap-3 rounded-[12px] px-4 py-3"
                  style={{ background: '#F8F9FB', border: '1px solid #DDE3EF' }}
                >
                  <div
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(201,168,76,0.1)', color: '#9A6F1A' }}
                  >
                    {req.icon}
                  </div>
                  <div>
                    <div className="text-[13px]" style={{ color: '#8C9BB5' }}>{req.label}</div>
                    <div className="text-[15px] font-semibold" style={{ color: '#0A1628' }}>{req.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/apply"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all duration-150"
                style={{ background: '#0F2B5B', color: 'white' }}
              >
                Check Eligibility
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all duration-150"
                style={{ background: 'white', color: '#0A1628', border: '1px solid #DDE3EF' }}
              >
                Talk to an Advisor
              </Link>
            </div>
          </div>

          <div className="rounded-[20px] p-8" style={{ background: '#F8F9FB', border: '1px solid #DDE3EF' }}>
            <h3 className="font-semibold text-[18px] mb-6" style={{ color: '#0A1628' }}>What we consider</h3>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Monthly bank deposits', weight: 'Primary factor' },
                { label: 'Average daily balance', weight: 'Primary factor' },
                { label: 'Time in business', weight: 'Key factor' },
                { label: 'Industry type', weight: 'Key factor' },
                { label: 'Personal credit score', weight: 'Secondary factor' },
                { label: 'Tax liens or judgments', weight: 'Reviewed individually' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[14px]" style={{ color: '#3A4A65' }}>{item.label}</span>
                  <span
                    className="text-[12px] font-semibold rounded-full px-3 py-1"
                    style={
                      item.weight === 'Primary factor'
                        ? { background: 'rgba(201,168,76,0.1)', color: '#9A6F1A' }
                        : item.weight === 'Key factor'
                        ? { background: '#F0FDF4', color: '#059669' }
                        : { background: '#F1F3F7', color: '#5A6A85' }
                    }
                  >
                    {item.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Industries ────────────────────────────────────────────────────────────
function Industries() {
  const industries = [
    { icon: <Utensils className="w-5 h-5" />, name: 'Restaurants & Food Service' },
    { icon: <Truck className="w-5 h-5" />, name: 'Transportation & Logistics' },
    { icon: <Wrench className="w-5 h-5" />, name: 'Auto & Mechanical Repair' },
    { icon: <Heart className="w-5 h-5" />, name: 'Healthcare & Medical' },
    { icon: <ShoppingBag className="w-5 h-5" />, name: 'Retail & E-commerce' },
    { icon: <Building2 className="w-5 h-5" />, name: 'Construction & Contracting' },
    { icon: <FileCheck className="w-5 h-5" />, name: 'Professional Services' },
    { icon: <Zap className="w-5 h-5" />, name: 'Technology & SaaS' },
  ];

  return (
    <section className="section" style={{ background: '#F8F9FB' }}>
      <div className="container-page">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>Industries Served</p>
          <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
            We fund businesses across every sector
          </h2>
          <p className="text-[17px] max-w-[440px] mx-auto" style={{ color: '#5A6A85' }}>
            From restaurants to SaaS companies, we&apos;ve built funding products for the way your business actually works.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {industries.map((ind) => (
            <div
              key={ind.name}
              className="bg-white rounded-[12px] p-5 flex items-center gap-3 transition-all duration-200 group cursor-default"
              style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 2px rgba(10,22,40,0.04)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#C9A84C';
                e.currentTarget.style.background = 'rgba(201,168,76,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#DDE3EF';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div
                className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors"
                style={{ background: '#F1F3F7', color: '#5A6A85' }}
              >
                {ind.icon}
              </div>
              <span className="text-[13px] font-medium leading-tight" style={{ color: '#3A4A65' }}>
                {ind.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why Choose Us ─────────────────────────────────────────────────────────
function WhyChooseUs() {
  const reasons = [
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Speed that matches your urgency',
      description: "We understand that business opportunities don't wait. Our team works around the clock to return decisions in hours, not days.",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Transparent terms, zero surprises',
      description: 'Your factor rate, payback amount, and payment schedule are disclosed before you sign. No hidden fees, no prepayment penalties on most products.',
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'A dedicated funding advisor',
      description: "You're assigned a real advisor — not a bot. They'll guide you through every step and advocate for the best offer on your behalf.",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: '50+ lenders competing for your deal',
      description: "We submit your file to our entire network and let lenders compete. You get the best rate the market will offer — not just the first one back.",
    },
    {
      icon: <FileCheck className="w-5 h-5" />,
      title: 'Minimal documentation',
      description: 'For most approvals, we only need 3 months of bank statements, a voided check, and ID. No tax returns, no business plans, no collateral.',
    },
    {
      icon: <Award className="w-5 h-5" />,
      title: 'Renewals that reward loyalty',
      description: "Once you're 50% paid down, you become eligible for renewal at improved terms. Our best clients fund multiple times a year.",
    },
  ];

  return (
    <section className="section" style={{ background: '#FFFFFF' }}>
      <div className="container-page">
        <div className="text-center mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>Why Elite Funding</p>
          <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
            Built for business owners, not spreadsheets
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="bg-white rounded-[16px] p-6"
              style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 4px rgba(10,22,40,0.06)' }}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                style={{ background: 'rgba(15,43,91,0.07)', color: '#0F2B5B' }}
              >
                {r.icon}
              </div>
              <h3 className="font-semibold text-[16px] mb-2" style={{ color: '#0A1628' }}>{r.title}</h3>
              <p className="text-[14px] leading-relaxed" style={{ color: '#5A6A85' }}>{r.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ──────────────────────────────────────────────────────────
function Testimonials() {
  const testimonials = [
    {
      name: 'Marcus Rivera',
      title: 'Owner, Metro Pizza Group',
      location: 'New York, NY',
      quote: "I applied on a Tuesday morning and had $75,000 in my account by Thursday afternoon. The advisor walked me through every term and the process was completely transparent. I've renewed twice since.",
      amount: '$75,000 funded',
    },
    {
      name: 'Jennifer Walsh',
      title: 'Owner, Greenfield Auto Repair',
      location: 'Chicago, IL',
      quote: "After three banks turned me down because I'd only been in business two years, Elite Funding had an offer in six hours. The working capital funded an equipment purchase that doubled my service capacity.",
      amount: '$50,000 funded',
    },
    {
      name: 'David Kim',
      title: 'CFO, Sunrise Medical Supplies',
      location: 'Los Angeles, CA',
      quote: "We use Elite Funding for our seasonal inventory purchases. The process is so streamlined now that it takes less than a day from request to funded. It's become a core part of our cash flow strategy.",
      amount: '$125,000 funded',
    },
  ];

  return (
    <section className="section" style={{ background: '#F8F9FB' }}>
      <div className="container-page">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>Client Stories</p>
          <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
            Real businesses, real results
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-[16px] p-6 flex flex-col"
              style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 4px rgba(10,22,40,0.06)' }}
            >
              <div className="flex items-center gap-1 mb-5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#C9A84C] text-[#C9A84C]" />
                ))}
              </div>
              <p className="text-[14px] leading-relaxed mb-6 flex-1" style={{ color: '#3A4A65' }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #EDF0F7' }}>
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: '#0A1628' }}>{t.name}</div>
                  <div className="text-[13px]" style={{ color: '#5A6A85' }}>{t.title}</div>
                  <div className="text-[12px]" style={{ color: '#8C9BB5' }}>{t.location}</div>
                </div>
                <span
                  className="text-[11px] font-semibold rounded-[6px] px-3 py-1"
                  style={{ background: 'rgba(201,168,76,0.1)', color: '#9A6F1A' }}
                >
                  {t.amount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────
function FAQ() {
  const faqs = [
    {
      q: 'How is a merchant cash advance different from a loan?',
      a: "An MCA is a purchase of future receivables, not a loan. There are no fixed monthly payments, no interest rate, and no set maturity date. You repay as a percentage of daily revenue, so payments naturally flex with your business.",
    },
    {
      q: 'What documents do I need to apply?',
      a: 'For most approvals, we only need your last 3 months of bank statements, a voided check, and a copy of your government-issued ID. Some larger amounts or certain industries may require additional documentation.',
    },
    {
      q: 'Does applying affect my credit score?',
      a: 'No. We perform a soft credit pull during the application review process, which does not affect your credit score. A hard pull is only performed if and when you accept a funded offer.',
    },
    {
      q: 'How quickly can I get funded?',
      a: 'Most approved businesses receive funding within 24 to 72 business hours of signing their contract. Many clients receive same-day funding.',
    },
    {
      q: 'Can I qualify with bad credit?',
      a: "Yes. While we do review your personal credit, it's not the primary factor. We focus heavily on your business's monthly revenue and banking activity. We fund businesses with credit scores as low as 500.",
    },
    {
      q: 'Can I have more than one advance at a time?',
      a: "We can work with certain stacking situations depending on your current balance and revenue. If you have existing advances, disclose them on your application — our team will structure an offer accordingly.",
    },
  ];

  return (
    <section className="section" style={{ background: '#FFFFFF' }}>
      <div className="container-page">
        <div className="max-w-[680px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#C9A84C' }}>FAQs</p>
            <h2 className="font-bold mb-4" style={{ fontSize: '32px', letterSpacing: '-0.01em', color: '#0A1628' }}>
              Common questions answered
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group bg-white overflow-hidden rounded-[12px]"
                style={{ border: '1px solid #DDE3EF', boxShadow: '0 1px 2px rgba(10,22,40,0.04)' }}
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none transition-colors" style={{ background: 'transparent' }}>
                  <span className="text-[15px] font-medium pr-4" style={{ color: '#0A1628' }}>{faq.q}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: '#8C9BB5' }} />
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-[14px] leading-relaxed" style={{ color: '#5A6A85' }}>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/faq" className="text-[14px] font-medium hover:underline" style={{ color: '#C9A84C' }}>
              View all frequently asked questions →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ─────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="section relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #040B16 0%, #060F1E 50%, #0A1628 100%)' }}>
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
      />
      <div className="container-page text-center relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: '#C9A84C' }}>Get Started Today</p>
        <h2
          className="font-bold text-white mb-5"
          style={{ fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
        >
          Ready to fund your next
          <br />
          growth milestone?
        </h2>
        <p className="text-[17px] mb-10 max-w-[420px] mx-auto leading-relaxed" style={{ color: '#5A6A85' }}>
          Join over 12,000 businesses that have trusted Elite Funding Solutions to fuel their growth.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/apply"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[16px] h-12 px-7 transition-all duration-150 w-full sm:w-auto"
            style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628', boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}
          >
            Get Pre-Qualified
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[16px] h-12 px-7 transition-all duration-150 w-full sm:w-auto"
            style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Speak With an Advisor
          </Link>
        </div>

        <p className="mt-6 text-[13px]" style={{ color: '#2A3A55' }}>
          No obligation &nbsp;&bull;&nbsp; No hard credit pull &nbsp;&bull;&nbsp; Decisions in hours
        </p>
      </div>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <FundingProducts />
      <HowItWorks />
      <Eligibility />
      <Industries />
      <WhyChooseUs />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </>
  );
}
