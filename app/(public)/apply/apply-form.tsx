'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Phone, RotateCcw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { APPLICATION_CHECKBOX_CONSENT, APPLICATION_DISCLOSURE_SECTIONS } from '@/lib/application-disclosures';
import { COMPANY, CONSENT_VERSION } from '@/lib/company';

type Step = 1 | 2 | 3 | 4;

type ApplicationFormData = {
  full_name: string;
  home_address: string;
  ssn: string;
  dob: string;
  cell_phone: string;
  email: string;
  ownership_percentage: string;
  co_owner_full_name: string;
  co_owner_home_address: string;
  co_owner_ssn: string;
  co_owner_dob: string;
  co_owner_cell_phone: string;
  co_owner_email: string;
  co_owner_ownership_percentage: string;
  company_name: string;
  business_address: string;
  ein: string;
  business_start_date: string;
  requested_amount: string;
  industry: string;
  use_of_funds: string;
  existing_advance_funder: string;
  existing_advance_balance: string;
  existing_advance_2_funder: string;
  existing_advance_2_balance: string;
  existing_advance_3_funder: string;
  existing_advance_3_balance: string;
  consent_accepted: boolean;
  signature_data_url: string;
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
  email: '',
  ownership_percentage: '100',
  co_owner_full_name: '',
  co_owner_home_address: '',
  co_owner_ssn: '',
  co_owner_dob: '',
  co_owner_cell_phone: '',
  co_owner_email: '',
  co_owner_ownership_percentage: '',
  company_name: '',
  business_address: '',
  ein: '',
  business_start_date: '',
  requested_amount: '',
  industry: '',
  use_of_funds: '',
  existing_advance_funder: '',
  existing_advance_balance: '',
  existing_advance_2_funder: '',
  existing_advance_2_balance: '',
  existing_advance_3_funder: '',
  existing_advance_3_balance: '',
  consent_accepted: false,
  signature_data_url: '',
  bot_field: '',
  referral_code: '',
  referral_path: '',
};

const steps = ['About You', 'About Your Business', 'Review and Sign', 'Confirmation'];

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

function prettyMoney(value: string) {
  const digits = digitsOnly(value).slice(0, 9);
  if (!digits) return '';
  return `$${Number(digits).toLocaleString()}`;
}

function hasCoOwnerData(data: ApplicationFormData) {
  return Boolean(
    data.co_owner_full_name.trim() ||
    data.co_owner_home_address.trim() ||
    data.co_owner_ssn.trim() ||
    data.co_owner_dob ||
    data.co_owner_cell_phone.trim() ||
    data.co_owner_email.trim() ||
    data.co_owner_ownership_percentage.trim(),
  );
}

function existingAdvanceRows(data: ApplicationFormData) {
  return [
    { funder: data.existing_advance_funder, balance: data.existing_advance_balance },
    { funder: data.existing_advance_2_funder, balance: data.existing_advance_2_balance },
    { funder: data.existing_advance_3_funder, balance: data.existing_advance_3_balance },
  ];
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  autoComplete,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">
        {label} {required && <span className="text-[#B91C1C]">*</span>}
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
      <p className="mt-1 text-[14px] font-medium leading-6 text-[#334155]">{text}</p>
    </div>
  );
}

function ReviewRow({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  const shown = sensitive && value ? `***-${digitsOnly(value).slice(-4)}` : value;
  return (
    <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#334155]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0F172A]">{shown || 'Missing'}</p>
    </div>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(Boolean(value));

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const pointForEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    const point = pointForEvent(event);
    drawingRef.current = true;
    hasInkRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = pointForEvent(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInkRef.current) onChange(canvas.toDataURL('image/png'));
  };

  const clearSignature = () => {
    hasInkRef.current = false;
    onChange('');
    resizeCanvas();
  };

  return (
    <div className="rounded-[10px] border border-[#CBD5E1] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#0F172A]">Draw your signature <span className="text-[#B91C1C]">*</span></p>
          <p className="text-[12px] font-medium leading-5 text-[#334155]">Use your mouse, finger, or trackpad. This signature is saved on the PDF application.</p>
        </div>
        <button type="button" onClick={clearSignature} className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#CBD5E1] px-3 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        data-testid="application-signature-pad"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
        className="h-[170px] w-full touch-none rounded-[8px] border border-dashed border-[#94A3B8] bg-white"
      />
      {value && <p className="mt-2 text-[12px] font-semibold text-[#047857]">Signature captured.</p>}
    </div>
  );
}

function StepAboutYou({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  const showCoOwnerReview = hasCoOwnerData(data);

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
        <InputField label="Email Address" value={data.email} onChange={(value) => update('email', value)} type="email" autoComplete="email" required={false} />
        <InputField label="Ownership Percentage" value={data.ownership_percentage} onChange={(value) => update('ownership_percentage', digitsOnly(value).slice(0, 3))} placeholder="100" />
      </div>
      <div className="rounded-[10px] border border-[#CBD5E1] bg-[#F8FAFC] p-4">
        <div className="mb-4">
          <h3 className="text-[16px] font-bold text-[#0F172A]">Co-owner / partner</h3>
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#334155]">Complete this only if another owner or principal should appear on the funding application.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <InputField label="Co-owner Full Name" value={data.co_owner_full_name} onChange={(value) => update('co_owner_full_name', value)} autoComplete="name" required={false} />
          </div>
          <div className="md:col-span-2">
            <InputField label="Co-owner Home Address" value={data.co_owner_home_address} onChange={(value) => update('co_owner_home_address', value)} autoComplete="street-address" placeholder="Street, city, state, ZIP" required={showCoOwnerReview} />
          </div>
          <InputField label="Co-owner Social Security Number" value={data.co_owner_ssn} onChange={(value) => update('co_owner_ssn', prettySsn(value))} placeholder="XXX-XX-XXXX" autoComplete="off" required={showCoOwnerReview} />
          <InputField label="Co-owner Date of Birth" value={data.co_owner_dob} onChange={(value) => update('co_owner_dob', value)} type="date" autoComplete="bday" required={showCoOwnerReview} />
          <InputField label="Co-owner Cell Phone Number" value={data.co_owner_cell_phone} onChange={(value) => update('co_owner_cell_phone', prettyPhone(value))} autoComplete="tel" required={false} />
          <InputField label="Co-owner Email Address" value={data.co_owner_email} onChange={(value) => update('co_owner_email', value)} type="email" autoComplete="email" required={false} />
          <InputField label="Co-owner Ownership Percentage" value={data.co_owner_ownership_percentage} onChange={(value) => update('co_owner_ownership_percentage', digitsOnly(value).slice(0, 3))} placeholder="50" required={showCoOwnerReview} />
        </div>
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
        <InputField label="Requested Funding Amount" value={data.requested_amount} onChange={(value) => update('requested_amount', prettyMoney(value))} placeholder="$75,000" />
        <InputField label="Industry" value={data.industry} onChange={(value) => update('industry', value)} placeholder="Restaurant, retail, construction..." />
        <InputField label="Use of Funds" value={data.use_of_funds} onChange={(value) => update('use_of_funds', value)} placeholder="Payroll, inventory, expansion..." required={false} />
        <div className="md:col-span-2 rounded-[10px] border border-[#CBD5E1] bg-[#F8FAFC] p-4">
          <h3 className="text-[16px] font-bold text-[#0F172A]">Open advances</h3>
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#334155]">List up to three current advance balances so the generated application is complete for funder review.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <InputField label="Open Advance Funder" value={data.existing_advance_funder} onChange={(value) => update('existing_advance_funder', value)} placeholder="Current funder, if any" required={false} />
            <InputField label="Open Advance Balance" value={data.existing_advance_balance} onChange={(value) => update('existing_advance_balance', prettyMoney(value))} placeholder="$12,500" required={false} />
            <InputField label="Open Advance 2 Funder" value={data.existing_advance_2_funder} onChange={(value) => update('existing_advance_2_funder', value)} placeholder="Second current funder" required={false} />
            <InputField label="Open Advance 2 Balance" value={data.existing_advance_2_balance} onChange={(value) => update('existing_advance_2_balance', prettyMoney(value))} placeholder="$8,000" required={false} />
            <InputField label="Open Advance 3 Funder" value={data.existing_advance_3_funder} onChange={(value) => update('existing_advance_3_funder', value)} placeholder="Third current funder" required={false} />
            <InputField label="Open Advance 3 Balance" value={data.existing_advance_3_balance} onChange={(value) => update('existing_advance_3_balance', prettyMoney(value))} placeholder="$4,500" required={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepReview({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  const showCoOwner = hasCoOwnerData(data);

  return (
    <div className="space-y-6">
      <SectionIntro title="Review and Sign" text="Confirm the basics, draw your signature, and authorize Elite Funding Solutions to review your funding options." />
      <div className="grid gap-3 md:grid-cols-2">
        <ReviewRow label="Full name" value={data.full_name} />
        <ReviewRow label="Cell phone" value={data.cell_phone} />
        <ReviewRow label="Email" value={data.email} />
        <ReviewRow label="Home address" value={data.home_address} />
        <ReviewRow label="Ownership" value={data.ownership_percentage ? `${data.ownership_percentage}%` : ''} />
        <ReviewRow label="SSN" value={data.ssn} sensitive />
        <ReviewRow label="Date of birth" value={data.dob} sensitive />
        <ReviewRow label="Company" value={data.company_name} />
        <ReviewRow label="Business address" value={data.business_address} />
        <ReviewRow label="EIN" value={data.ein} sensitive />
        <ReviewRow label="Business start date" value={data.business_start_date} />
        <ReviewRow label="Requested amount" value={data.requested_amount} />
        <ReviewRow label="Industry" value={data.industry} />
        <ReviewRow label="Use of funds" value={data.use_of_funds} />
        {existingAdvanceRows(data).map((advance, index) => {
          const value = [advance.funder, advance.balance].filter(Boolean).join(' - ');
          return value ? <ReviewRow key={index} label={`Open advance ${index + 1}`} value={value} /> : null;
        })}
        {showCoOwner && <ReviewRow label="Co-owner" value={data.co_owner_full_name} />}
        {showCoOwner && <ReviewRow label="Co-owner ownership" value={data.co_owner_ownership_percentage ? `${data.co_owner_ownership_percentage}%` : ''} />}
        {showCoOwner && <ReviewRow label="Co-owner address" value={data.co_owner_home_address} />}
        {showCoOwner && <ReviewRow label="Co-owner SSN" value={data.co_owner_ssn} sensitive />}
        {showCoOwner && <ReviewRow label="Co-owner DOB" value={data.co_owner_dob} sensitive />}
      </div>
      <SignaturePad value={data.signature_data_url} onChange={(value) => update('signature_data_url', value)} />
      <div className="application-disclosure-copy rounded-[12px] border border-[#CBD5E1] bg-white p-4 text-[#0F172A] shadow-sm md:p-5">
        <div className="mb-4 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <h3 className="text-[16px] font-semibold text-[#0F2B5B]">Important Application Authorization</h3>
          <p className="mt-2 text-[15px] font-semibold leading-[1.6] text-[#0F172A]">
            Please read these disclosures before submitting. They explain what Elite Funding Solutions and its funding partners may review, how consent is recorded, and how your information may be used.
          </p>
        </div>
        <div className="grid gap-4">
          {APPLICATION_DISCLOSURE_SECTIONS.map((section) => (
            <section key={section.title} className="rounded-[10px] border border-[#CBD5E1] bg-white p-4">
              <h3 className="text-[15px] font-bold text-[#0F2B5B]">{section.title}</h3>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-[14px] font-medium leading-[1.6] text-[#0F172A]">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <label className="application-disclosure-copy flex cursor-pointer gap-3 rounded-[10px] border border-[#64748B] bg-white p-4 shadow-sm">
        <input
          type="checkbox"
          checked={data.consent_accepted}
          onChange={(event) => update('consent_accepted', event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-[#475569]"
        />
        <span className="text-[14px] font-semibold leading-[1.6] text-[#0F172A]">
          {APPLICATION_CHECKBOX_CONSENT}
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
        Thank you. Your signed application has been received. An Elite Funding Solutions funding specialist will review your information and contact you shortly.
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

  const trackApplicationEvent = (event: string, extra: Record<string, unknown> = {}) => {
    const payload = JSON.stringify({
      event,
      step: currentStep < 4 ? currentStep : 'confirmation',
      referral_code: referral?.code || form.referral_code || '',
      referral_path: referral?.path || form.referral_path || '',
      ...extra,
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/application-event', new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch('/api/analytics/application-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  };

  useEffect(() => {
    trackApplicationEvent(currentStep === 4 ? 'application_submit_success' : 'application_step_started');
    // Tracking must avoid sensitive form values, so only step/referral metadata is sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

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
      if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Please enter a valid email address.';
      const ownership = Number(form.ownership_percentage);
      if (!Number.isFinite(ownership) || ownership <= 0 || ownership > 100) return 'Please enter an ownership percentage from 1 to 100.';
      if (hasCoOwnerData(form)) {
        if (form.co_owner_full_name.trim().split(/\s+/).length < 2) return 'Please enter the co-owner full name.';
        if (form.co_owner_home_address.trim().length < 8) return 'Please enter the co-owner full home address.';
        if (digitsOnly(form.co_owner_ssn).length !== 9) return 'Please enter a valid 9 digit co-owner Social Security Number.';
        if (!form.co_owner_dob || Number.isNaN(new Date(form.co_owner_dob).getTime())) return 'Please enter a valid co-owner date of birth.';
        if (form.co_owner_cell_phone && digitsOnly(form.co_owner_cell_phone).length !== 10) return 'Please enter a valid 10 digit co-owner cell phone number.';
        if (form.co_owner_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.co_owner_email)) return 'Please enter a valid co-owner email address.';
        const coOwnerOwnership = Number(form.co_owner_ownership_percentage);
        if (!Number.isFinite(coOwnerOwnership) || coOwnerOwnership <= 0 || coOwnerOwnership > 100) return 'Please enter a co-owner ownership percentage from 1 to 100.';
        if (ownership + coOwnerOwnership > 100) return 'Owner and co-owner ownership percentages cannot exceed 100.';
      }
    }
    if (currentStep === 2) {
      if (form.company_name.trim().length < 2) return 'Please enter the company name.';
      if (form.business_address.trim().length < 8) return 'Please enter the full business address.';
      if (digitsOnly(form.ein).length !== 9) return 'Please enter a valid 9 digit Tax ID / EIN.';
      if (!form.business_start_date || Number.isNaN(new Date(form.business_start_date).getTime())) return 'Please enter a valid business start date.';
      if (!form.requested_amount || Number(digitsOnly(form.requested_amount)) <= 0) return 'Please enter a valid requested funding amount.';
      if (form.industry.trim().length < 2) return 'Please enter the business industry.';
      const invalidAdvanceBalance = existingAdvanceRows(form).some((advance) => advance.balance && Number(digitsOnly(advance.balance)) <= 0);
      if (invalidAdvanceBalance) return 'Please enter valid open advance balances.';
    }
    if (currentStep === 3) {
      if (!form.signature_data_url) return 'Please draw your signature before submitting.';
      if (!form.consent_accepted) return 'Please accept the consent before submitting.';
    }
    return null;
  };

  const continueStep = () => {
    const error = validateCurrentStep();
    if (error) {
      trackApplicationEvent('application_validation_error', { field: error });
      toast.error(error);
      return;
    }
    trackApplicationEvent('application_step_completed');
    next();
  };

  const handleSubmit = async () => {
    const error = validateCurrentStep();
    if (error) {
      trackApplicationEvent('application_validation_error', { field: error });
      toast.error(error);
      return;
    }

    setSubmitting(true);
    trackApplicationEvent('application_submit_started');
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

      const signatureResponse = await fetch(`/api/applications/${result.applicationId}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data_url: form.signature_data_url, consent_version: CONSENT_VERSION }),
      });
      const signatureResult = await signatureResponse.json();
      if (!signatureResponse.ok || !signatureResult.success) throw new Error(signatureResult.error || 'Application was saved, but the signed PDF could not be generated. Please contact support.');

      setCurrentStep(4);
    } catch (err) {
      trackApplicationEvent('application_submit_failed');
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
                <Shield className="mr-2 inline h-4 w-4 text-[#0F2B5B]" /> SSN, DOB, Tax ID, and signature are encrypted or protected before storage.
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[#F4F4F5] pt-6">
                <button type="button" onClick={back} disabled={currentStep === 1 || submitting} className="inline-flex h-11 items-center gap-2 rounded-[8px] px-4 py-2 text-[14px] font-medium text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] disabled:cursor-not-allowed disabled:text-[#A1A1AA]">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {currentStep === 3 ? (
                  <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-[#061326] px-5 text-[14px] font-semibold text-white transition-all hover:bg-[#0A1730] disabled:opacity-50">
                    {submitting ? 'Generating signed PDF...' : 'Get My Funding Options'} {!submitting && <CheckCircle2 className="h-4 w-4" />}
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
