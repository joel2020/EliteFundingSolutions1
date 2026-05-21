'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Phone, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { COMPANY, CONSENT_VERSION } from '@/lib/company';

type Step = 1 | 2 | 3 | 4;

type ApplicationFormData = {
  full_name: string;
  home_address: string;
  ssn: string;
  dob: string;
  cell_phone: string;
  company_name: string;
  business_address: string;
  ein: string;
  business_start_date: string;
  consent_accepted: boolean;
  bot_field: string;
  referral_code: string;
  referral_path: string;
};

const initialForm: ApplicationFormData = {
  full_name: '',
  home_address: '',
  ssn: '',
  dob: '',
  cell_phone: '',
  company_name: '',
  business_address: '',
  ein: '',
  business_start_date: '',
  consent_accepted: false,
  bot_field: '',
  referral_code: '',
  referral_path: '',
};

const steps = ['About You', 'About Your Business', 'Review and Submit', 'Confirmation'];

function fieldTestId(label: string) {
  return `application-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function prettyPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function prettySsn(value: string) {
  const digits = digitsOnly(value).slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function prettyEin(value: string) {
  const digits = digitsOnly(value).slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">
        {label} <span className="text-[#B91C1C]">*</span>
      </label>
      <input
        data-testid={fieldTestId(label)}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-[16px] text-[#0F172A] outline-none transition focus:border-[#0F2B5B] focus:ring-2 focus:ring-[#0F2B5B]/10"
      />
    </div>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-[24px] font-bold text-[#0F172A]">{title}</h2>
      <p className="mt-1 text-[14px] leading-6 text-[#64748B]">{text}</p>
    </div>
  );
}

function ReviewRow({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  const shown = sensitive && value ? `***-${digitsOnly(value).slice(-4)}` : value;
  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0F172A]">{shown || 'Missing'}</p>
    </div>
  );
}

function StepAboutYou({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="About You" text="Tell us who is applying. This information is encrypted and used for funding review." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <InputField label="Full Name" value={data.full_name} onChange={(value) => update('full_name', value)} autoComplete="name" />
        </div>
        <div className="md:col-span-2">
          <InputField label="Home Address" value={data.home_address} onChange={(value) => update('home_address', value)} autoComplete="street-address" placeholder="Street, city, state, ZIP" />
        </div>
        <InputField label="Social Security Number" value={data.ssn} onChange={(value) => update('ssn', prettySsn(value))} placeholder="XXX-XX-XXXX" autoComplete="off" />
        <InputField label="Date of Birth" value={data.dob} onChange={(value) => update('dob', value)} type="date" autoComplete="bday" />
        <InputField label="Cell Phone Number" value={data.cell_phone} onChange={(value) => update('cell_phone', prettyPhone(value))} autoComplete="tel" />
      </div>
    </div>
  );
}

function StepBusiness({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="About Your Business" text="Add the business identity details needed to start matching funding options." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <InputField label="Company Name" value={data.company_name} onChange={(value) => update('company_name', value)} autoComplete="organization" />
        </div>
        <div className="md:col-span-2">
          <InputField label="Business Address" value={data.business_address} onChange={(value) => update('business_address', value)} placeholder="Street, city, state, ZIP" />
        </div>
        <InputField label="Tax ID / EIN" value={data.ein} onChange={(value) => update('ein', prettyEin(value))} placeholder="XX-XXXXXXX" autoComplete="off" />
        <InputField label="Business Start Date" value={data.business_start_date} onChange={(value) => update('business_start_date', value)} type="date" />
      </div>
    </div>
  );
}

function StepReview({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="Review and Submit" text="Confirm the basics and authorize Elite Funding Solutions to review your funding options." />
      <div className="grid gap-3 md:grid-cols-2">
        <ReviewRow label="Full name" value={data.full_name} />
        <ReviewRow label="Cell phone" value={data.cell_phone} />
        <ReviewRow label="Home address" value={data.home_address} />
        <ReviewRow label="SSN" value={data.ssn} sensitive />
        <ReviewRow label="Date of birth" value={data.dob} sensitive />
        <ReviewRow label="Company" value={data.company_name} />
        <ReviewRow label="Business address" value={data.business_address} />
        <ReviewRow label="EIN" value={data.ein} sensitive />
        <ReviewRow label="Business start date" value={data.business_start_date} />
      </div>
      <label className="flex cursor-pointer gap-3 rounded-[10px] border border-[#CBD5E1] bg-white p-4">
        <input
          type="checkbox"
          checked={data.consent_accepted}
          onChange={(event) => update('consent_accepted', event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[#94A3B8]"
        />
        <span className="text-sm leading-6 text-[#334155]">
          I certify that this information is accurate and authorize Elite Funding Solutions and its funding partners to review my business, identity, credit, and financial information for funding options. I consent to electronic records and communications for this application.
        </span>
      </label>
      <input type="text" value={data.bot_field} onChange={(event) => update('bot_field', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    </div>
  );
}

function StepConfirmation() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#DCFCE7] bg-[#F0FDF4]">
        <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
      </div>
      <h2 className="mb-3 text-[26px] font-bold text-[#09090B]">Application Received</h2>
      <p className="mx-auto mb-8 max-w-[520px] text-[16px] leading-relaxed text-[#475569]">
        Thank you. Your application has been received. An Elite Funding Solutions funding specialist will review your information and contact you shortly.
      </p>
      <a href="/" className="btn-gold">Return Home <ArrowRight className="h-4 w-4" /></a>
    </div>
  );
}

export default function ApplyForm({ referral }: { referral?: { code: string; path: string; repName?: string | null } }) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [form, setForm] = useState<ApplicationFormData>(() => ({
    ...initialForm,
    referral_code: referral?.code || '',
    referral_path: referral?.path || '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const progressPct = useMemo(() => ((currentStep - 1) / 3) * 100, [currentStep]);

  const updateField = <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const next = () => setCurrentStep((step) => Math.min(step + 1, 4) as Step);
  const back = () => setCurrentStep((step) => Math.max(step - 1, 1) as Step);

  const validateCurrentStep = () => {
    if (currentStep === 1) {
      if (form.full_name.trim().split(/\s+/).length < 2) return 'Please enter your full name.';
      if (form.home_address.trim().length < 8) return 'Please enter your full home address.';
      if (digitsOnly(form.ssn).length !== 9) return 'Please enter a valid 9 digit Social Security Number.';
      if (!form.dob || Number.isNaN(new Date(form.dob).getTime())) return 'Please enter a valid date of birth.';
      if (digitsOnly(form.cell_phone).length !== 10) return 'Please enter a valid 10 digit cell phone number.';
    }
    if (currentStep === 2) {
      if (form.company_name.trim().length < 2) return 'Please enter the company name.';
      if (form.business_address.trim().length < 8) return 'Please enter the full business address.';
      if (digitsOnly(form.ein).length !== 9) return 'Please enter a valid 9 digit Tax ID / EIN.';
      if (!form.business_start_date || Number.isNaN(new Date(form.business_start_date).getTime())) return 'Please enter a valid business start date.';
    }
    if (currentStep === 3 && !form.consent_accepted) return 'Please accept the consent before submitting.';
    return null;
  };

  const continueStep = () => {
    const error = validateCurrentStep();
    if (error) {
      toast.error(error);
      return;
    }
    next();
  };

  const handleSubmit = async () => {
    const error = validateCurrentStep();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          consent_version: CONSENT_VERSION,
          referral_code: referral?.code || form.referral_code,
          referral_path: referral?.path || form.referral_path,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Application submission failed.');
      setCurrentStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030812] pb-20 pt-10 text-white">
      <div className="mx-auto max-w-[860px] px-5 md:px-8">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <p className="eyebrow mb-3">Secure funding application</p>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">Get your funding options faster.</h1>
          <p className="text-[16px] leading-7 text-slate-300">A short encrypted application for merchant cash advance and business funding review.</p>
        </div>
        {referral?.repName && currentStep < 4 && <div className="mx-auto mb-6 max-w-3xl rounded-[10px] border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3 text-center text-sm font-semibold text-[#f1d08a]">Your application is connected to {referral.repName}.</div>}
        {currentStep < 4 && (
          <div className="mb-6" data-testid="application-step">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-bold text-white">Step {currentStep} of 3: {steps[currentStep - 1]}</span>
              <span className="rounded-full bg-[#061326] px-3 py-1 text-[12px] font-bold text-white">{Math.round(progressPct)}% complete</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/15" aria-label="Application progress">
              <div className="h-full rounded-full transition-all duration-300" style={{ background: '#C9A84C', width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <div className="premium-card p-5 md:p-8">
          {currentStep === 1 && <StepAboutYou data={form} update={updateField} />}
          {currentStep === 2 && <StepBusiness data={form} update={updateField} />}
          {currentStep === 3 && <StepReview data={form} update={updateField} />}
          {currentStep === 4 && <StepConfirmation />}
          {currentStep < 4 && (
            <>
              <div className="mt-8 rounded-[10px] border border-[#DDE3EF] bg-[#F8F9FB] p-4 text-sm font-semibold text-[#0A1628]">
                <Shield className="mr-2 inline h-4 w-4 text-[#0F2B5B]" /> SSN, DOB, and Tax ID are encrypted before storage.
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[#F4F4F5] pt-6">
                <button type="button" onClick={back} disabled={currentStep === 1} className="inline-flex h-11 items-center gap-2 rounded-[8px] px-4 py-2 text-[14px] font-medium text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] disabled:cursor-not-allowed disabled:text-[#A1A1AA]">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {currentStep === 3 ? (
                  <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-[#061326] px-5 text-[14px] font-semibold text-white transition-all hover:bg-[#0A1730] disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Get My Funding Options'} {!submitting && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                ) : (
                  <button type="button" onClick={continueStep} className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-[#0F2B5B] px-5 text-[14px] font-semibold text-white transition-all hover:bg-[#0A1E42]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {currentStep < 4 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12px] text-[#8C9BB5]">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Secure</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Encrypted</span>
            <a href={`tel:${COMPANY.phoneHref}`} className="flex items-center gap-1.5 font-semibold text-[#e7c579]"><Phone className="h-3.5 w-3.5" />Need help? Call {COMPANY.phone}</a>
          </div>
        )}
      </div>
    </div>
  );
}
