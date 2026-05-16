'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY } from '@/lib/company';

const revenueOptions = ['$10K-$25K', '$25K-$50K', '$50K-$100K', '$100K-$250K', '$250K+'];
const timeOptions = ['Under 6 months', '6-12 months', '1-2 years', '2-5 years', '5+ years'];
const timingOptions = ['ASAP', 'This week', '2-4 weeks', 'Exploring options'];
type FitField = 'name' | 'business' | 'email' | 'phone' | 'monthlyRevenue' | 'timeInBusiness' | 'requestedAmount' | 'fundingTiming' | 'useOfFunds';

export default function FundingFitCheckForm() {
  const [form, setForm] = useState({
    name: '',
    business: '',
    email: '',
    phone: '',
    monthlyRevenue: '',
    timeInBusiness: '',
    requestedAmount: '',
    fundingTiming: '',
    useOfFunds: '',
    bot_field: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Partial<Record<FitField, boolean>>>({});
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== 'bot_field') setTouched((current) => ({ ...current, [key]: true }));
  };

  const fieldErrors: Partial<Record<FitField, string>> = {
    name: form.name.trim() ? '' : 'Enter your full name.',
    business: form.business.trim() ? '' : 'Enter the business name.',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? '' : 'Enter a valid email address.',
    phone: form.phone.replace(/\D/g, '').length >= 10 ? '' : 'Enter a valid phone number.',
    monthlyRevenue: form.monthlyRevenue ? '' : 'Select monthly revenue.',
    timeInBusiness: form.timeInBusiness ? '' : 'Select time in business.',
    requestedAmount: form.requestedAmount.trim() ? '' : 'Enter the requested amount.',
    fundingTiming: form.fundingTiming ? '' : 'Select funding timing.',
    useOfFunds: form.useOfFunds.trim() ? '' : 'Describe the use of funds.',
  };

  const visibleError = (field: FitField) => (submittedOnce || touched[field]) ? fieldErrors[field] || '' : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmittedOnce(true);

    const firstError = (Object.values(fieldErrors).filter(Boolean)[0] || '') as string;
    if (firstError) {
      setError('Please fix the highlighted fields. This check does not ask for SSN, EIN, bank statements, or account numbers.');
      return;
    }

    setSubmitting(true);
    const message = [
      `Business: ${form.business}`,
      `Monthly revenue: ${form.monthlyRevenue}`,
      `Time in business: ${form.timeInBusiness}`,
      `Requested amount: ${form.requestedAmount}`,
      `Timing: ${form.fundingTiming}`,
      `Use of funds: ${form.useOfFunds}`,
      '',
      'This lead requested a lightweight funding fit check before the full application.',
    ].join('\n');

    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, message, type: 'funding_fit_check', bot_field: form.bot_field }),
    });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok || !result.success) {
      setError(result.error || 'We could not send the fit check. Please call us directly.');
      return;
    }
    setSent(true);
  };

  return (
    <main className="bg-[#030812] text-white">
      <section className="page-hero-dark">
        <div className="container-page grid gap-10 py-20 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow mb-4">Funding fit check</p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">Start with a light review before the full application.</h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Share the basics first. An Elite advisor can review product fit, likely document needs, and whether the full secure application makes sense for your request.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
              {[
                ['No SSN here', 'The full application collects sensitive owner details only when you are ready.'],
                ['Advisor-led', 'A person reviews the objective before pushing documents.'],
                ['No obligation', 'Use the fit check to understand direction before accepting any offer.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-sm border border-[#d6af62]/20 bg-[#071322] p-4">
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-2 leading-6 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card p-5 md:p-7">
            {sent ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-semibold text-white">Fit check received</h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-slate-300">An Elite advisor will review the funding profile and contact you with next steps.</p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/apply" className="btn-gold">Complete full application</Link>
                  <a href={`tel:${COMPANY.phoneHref}`} className="btn-dark-outline">Call {COMPANY.phone}</a>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5" noValidate>
                <input type="text" tabIndex={-1} autoComplete="off" value={form.bot_field} onChange={(event) => update('bot_field', event.target.value)} className="hidden" aria-hidden="true" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">Quick funding profile</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">This is not the full application and does not collect SSN, EIN, or bank statements.</p>
                </div>
                {error && <div role="alert" className="rounded-sm border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name" value={form.name} onChange={(value) => update('name', value)} error={visibleError('name')} required />
                  <Field label="Business name" value={form.business} onChange={(value) => update('business', value)} error={visibleError('business')} required />
                  <Field label="Email" value={form.email} onChange={(value) => update('email', value)} type="email" error={visibleError('email')} required />
                  <Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} type="tel" error={visibleError('phone')} required />
                  <Select label="Monthly revenue" value={form.monthlyRevenue} onChange={(value) => update('monthlyRevenue', value)} options={revenueOptions} placeholder="Select revenue range" error={visibleError('monthlyRevenue')} required />
                  <Select label="Time in business" value={form.timeInBusiness} onChange={(value) => update('timeInBusiness', value)} options={timeOptions} placeholder="Select operating history" error={visibleError('timeInBusiness')} required />
                  <Field label="Requested amount" value={form.requestedAmount} onChange={(value) => update('requestedAmount', value)} placeholder="$100,000" error={visibleError('requestedAmount')} required />
                  <Select label="Funding timing" value={form.fundingTiming} onChange={(value) => update('fundingTiming', value)} options={timingOptions} placeholder="Select timing" error={visibleError('fundingTiming')} required />
                </div>
                <label className="block text-sm font-semibold text-white">
                  Use of funds *
                  <textarea value={form.useOfFunds} onChange={(event) => update('useOfFunds', event.target.value)} aria-invalid={Boolean(visibleError('useOfFunds'))} aria-describedby={visibleError('useOfFunds') ? 'fit-use-of-funds-error' : undefined} rows={4} className="mt-2 w-full resize-none rounded-[10px] border border-[#DDE3EF] bg-white px-4 py-3 text-[15px] text-[#0A1628] outline-none transition focus:border-[#C9A84C] focus:ring-4 focus:ring-[#C9A84C]/15" placeholder="Inventory, payroll, equipment, expansion, receivables timing" />
                  {visibleError('useOfFunds') && <p id="fit-use-of-funds-error" className="mt-1 text-xs font-medium text-red-100">{visibleError('useOfFunds')}</p>}
                </label>
                <div className="rounded-sm border border-[#d6af62]/18 bg-[#030812]/70 p-4 text-sm leading-6 text-slate-300">
                  <ShieldCheck className="mr-2 inline h-4 w-4 text-[#d6af62]" />
                  An advisor reviews this before requesting sensitive documents.
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="submit" disabled={submitting} className="btn-gold h-12 px-7">
                    {submitting ? 'Sending...' : 'Request fit check'} {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                  <Link href="/apply" className="inline-flex items-center gap-2 text-sm font-semibold text-[#e7c579]">
                    Full secure application <LockKeyhole className="h-4 w-4" />
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="rounded-sm border border-[#d6af62]/18 bg-[#071322] p-6 md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Prefer to talk through it?</h2>
            <p className="mt-2 text-slate-400">Call the funding desk and ask what documents make sense for your request.</p>
          </div>
          <a href={`tel:${COMPANY.phoneHref}`} className="btn-dark-outline mt-5 md:mt-0">
            <Phone className="h-4 w-4" /> {COMPANY.phone}
          </a>
        </div>
      </section>
    </main>
  );
}

function fieldId(label: string) {
  return `fit-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false, error = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; error?: string }) {
  const id = fieldId(label);
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-white">{label} {required && '*'}</label>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="input-field mt-2" />
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-red-100">{error}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder, required = false, error = '' }: { label: string; value: string; onChange: (value: string) => void; options: string[]; placeholder: string; required?: boolean; error?: string }) {
  const id = fieldId(label);
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-white">{label} {required && '*'}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="input-field mt-2 appearance-none bg-white">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-red-100">{error}</p>}
    </div>
  );
}
