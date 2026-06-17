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
  business_city: string;
  business_state: string;
  business_zip: string;
  average_monthly_revenue: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  credit_score: string;
  co_owner_city: string;
  co_owner_state: string;
  co_owner_zip: string;
  co_owner_credit_score: string;
  existing_advance_payment: string;
  existing_advance_original: string;
  existing_advance_2_payment: string;
  existing_advance_2_original: string;
  existing_advance_3_payment: string;
  existing_advance_3_original: string;
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
  business_city: '',
  business_state: '',
  business_zip: '',
  average_monthly_revenue: '',
  owner_city: '',
  owner_state: '',
  owner_zip: '',
  credit_score: '',
  co_owner_city: '',
  co_owner_state: '',
  co_owner_zip: '',
  co_owner_credit_score: '',
  existing_advance_payment: '',
  existing_advance_original: '',
  existing_advance_2_payment: '',
  existing_advance_2_original: '',
  existing_advance_3_payment: '',
  existing_advance_3_original: '',
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
  const [showCoOwner, setShowCoOwner] = useState(hasCoOwnerData(data));

  return (
    <div className="space-y-6">
      <SectionIntro title="Primary Owner Information" text="Tell us who is applying. This information is encrypted and used for funding review." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <InputField label="Full Name" value={data.full_name} onChange={(value) => update('full_name', value)} autoComplete="name" />
        </div>
        <InputField label="Estimated Credit Score" value={data.credit_score} onChange={(value) => update('credit_score', value)} placeholder="e.g. 680" required={false} />
        <InputField label="Ownership Percentage" value={data.ownership_percentage} onChange={(value) => update('ownership_percentage', digitsOnly(value).slice(0, 3))} placeholder="100" />
        <InputField label="Social Security Number" value={data.ssn} onChange={(value) => update('ssn', value)} placeholder="Enter 9-digit SSN" autoComplete="off" />
        <InputField label="Date of Birth" value={data.dob} onChange={(value) => update('dob', value)} type="date" autoComplete="bday" />
        <InputField label="Email Address" value={data.email} onChange={(value) => update('email', value)} type="email" autoComplete="email" />
        <InputField label="Cell Phone Number" value={data.cell_phone} onChange={(value) => update('cell_phone', value)} placeholder="Enter phone number" autoComplete="tel" />
        <div className="md:col-span-2">
          <InputField label="Home Street Address" value={data.home_address} onChange={(value) => update('home_address', value)} autoComplete="address-line1" placeholder="123 Home St" />
        </div>
        <div className="md:col-span-2">
          <InputField label="City" value={data.owner_city} onChange={(value) => update('owner_city', value)} autoComplete="address-level2" placeholder="City" />
        </div>
        <InputField label="State" value={data.owner_state} onChange={(value) => update('owner_state', value)} autoComplete="address-level1" placeholder="State (e.g. NY)" />
        <InputField label="Zip Code" value={data.owner_zip} onChange={(value) => update('owner_zip', value)} autoComplete="postal-code" placeholder="Zip code" />
      </div>
      {showCoOwner ? (
        <div className="rounded-[10px] border border-[#CBD5E1] bg-[#F8FAFC] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#0F172A]">Second owner / partner</h3>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#334155]">Complete this only if another owner or principal should appear on the funding application.</p>
            </div>
            <button type="button" onClick={() => setShowCoOwner(false)} className="shrink-0 rounded-[7px] border border-[#CBD5E1] px-3 py-1.5 text-[12px] font-semibold text-[#334155] hover:bg-white">Remove</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <InputField label="Co-owner Full Name" value={data.co_owner_full_name} onChange={(value) => update('co_owner_full_name', value)} autoComplete="name" />
            </div>
            <InputField label="Co-owner Estimated Credit Score" value={data.co_owner_credit_score} onChange={(value) => update('co_owner_credit_score', value)} placeholder="e.g. 680" required={false} />
            <InputField label="Co-owner Ownership Percentage" value={data.co_owner_ownership_percentage} onChange={(value) => update('co_owner_ownership_percentage', digitsOnly(value).slice(0, 3))} placeholder="50" />
            <InputField label="Co-owner Social Security Number" value={data.co_owner_ssn} onChange={(value) => update('co_owner_ssn', value)} placeholder="Enter 9-digit SSN" autoComplete="off" />
            <InputField label="Co-owner Date of Birth" value={data.co_owner_dob} onChange={(value) => update('co_owner_dob', value)} type="date" autoComplete="bday" />
            <InputField label="Co-owner Email Address" value={data.co_owner_email} onChange={(value) => update('co_owner_email', value)} type="email" autoComplete="email" required={false} />
            <InputField label="Co-owner Cell Phone Number" value={data.co_owner_cell_phone} onChange={(value) => update('co_owner_cell_phone', value)} placeholder="Enter phone number" autoComplete="tel" required={false} />
            <div className="md:col-span-2">
              <InputField label="Co-owner Home Street Address" value={data.co_owner_home_address} onChange={(value) => update('co_owner_home_address', value)} autoComplete="address-line1" placeholder="123 Home St" />
            </div>
            <div className="md:col-span-2">
              <InputField label="Co-owner City" value={data.co_owner_city} onChange={(value) => update('co_owner_city', value)} placeholder="City" />
            </div>
            <InputField label="Co-owner State" value={data.co_owner_state} onChange={(value) => update('co_owner_state', value)} placeholder="State (e.g. NY)" />
            <InputField label="Co-owner Zip Code" value={data.co_owner_zip} onChange={(value) => update('co_owner_zip', value)} placeholder="Zip code" />
          </div>
        </div>
      ) : (
        <button type="button" data-testid="add-second-owner" onClick={() => setShowCoOwner(true)} className="w-full rounded-[10px] border border-dashed border-[#94A3B8] bg-white py-3 text-[14px] font-semibold text-[#0F2B5B] hover:bg-[#F8FAFC]">+ Add Second Owner</button>
      )}
    </div>
  );
}

function StepBusiness({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  const [hasAdvances, setHasAdvances] = useState(existingAdvanceRows(data).some((row) => row.funder || row.balance));
  return (
    <div className="space-y-6">
      <SectionIntro title="Business Information" text="Add the business identity details needed to start matching funding options." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <InputField label="Company Name" value={data.company_name} onChange={(value) => update('company_name', value)} autoComplete="organization" />
        </div>
        <div className="md:col-span-2">
          <InputField label="Business Street Address" value={data.business_address} onChange={(value) => update('business_address', value)} placeholder="123 Main St" autoComplete="address-line1" />
        </div>
        <div className="md:col-span-2">
          <InputField label="City" value={data.business_city} onChange={(value) => update('business_city', value)} placeholder="City" autoComplete="address-level2" />
        </div>
        <InputField label="State" value={data.business_state} onChange={(value) => update('business_state', value)} placeholder="State (e.g. NY)" autoComplete="address-level1" />
        <InputField label="Zip Code" value={data.business_zip} onChange={(value) => update('business_zip', value)} placeholder="Zip code" autoComplete="postal-code" />
        <InputField label="Business EIN / Tax ID" value={data.ein} onChange={(value) => update('ein', value)} placeholder="Enter 9-digit Tax ID" autoComplete="off" />
        <InputField label="Business Start Date" value={data.business_start_date} onChange={(value) => update('business_start_date', value)} type="date" />
        <InputField label="Industry / Business Type" value={data.industry} onChange={(value) => update('industry', value)} placeholder="Restaurant, retail, construction..." />
        <InputField label="Average Monthly Revenue" value={data.average_monthly_revenue} onChange={(value) => update('average_monthly_revenue', value)} placeholder="Enter monthly revenue in dollars" />
        <InputField label="Amount Requested" value={data.requested_amount} onChange={(value) => update('requested_amount', value)} placeholder="Enter amount in dollars" />
        <div className="md:col-span-2"><InputField label="Use of Funds" value={data.use_of_funds} onChange={(value) => update('use_of_funds', value)} placeholder="Payroll, inventory, expansion..." required={false} /></div>
        <div className="md:col-span-2 rounded-[10px] border border-[#CBD5E1] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#0F172A]">Existing advances or loans</h3>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#334155]">Does the business currently have any open advances, loans, or funding balances?</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasAdvances(true)} className={`rounded-[7px] border px-4 py-1.5 text-[13px] font-semibold ${hasAdvances ? 'border-[#0F2B5B] bg-[#0F2B5B] text-white' : 'border-[#CBD5E1] bg-white text-[#334155]'}`}>Yes</button>
              <button type="button" onClick={() => setHasAdvances(false)} className={`rounded-[7px] border px-4 py-1.5 text-[13px] font-semibold ${!hasAdvances ? 'border-[#0F2B5B] bg-[#0F2B5B] text-white' : 'border-[#CBD5E1] bg-white text-[#334155]'}`}>No</button>
            </div>
          </div>
          {hasAdvances && <div className="mt-4 grid gap-4 md:grid-cols-2">
            <InputField label="Lender / Funding Company" value={data.existing_advance_funder} onChange={(value) => update('existing_advance_funder', value)} placeholder="Funder name" required={false} />
            <InputField label="Current Balance" value={data.existing_advance_balance} onChange={(value) => update('existing_advance_balance', value)} placeholder="Current balance" required={false} />
            <InputField label="Daily / Weekly Payment" value={data.existing_advance_payment} onChange={(value) => update('existing_advance_payment', value)} placeholder="Payment amount" required={false} />
            <InputField label="Original Funding Amount" value={data.existing_advance_original} onChange={(value) => update('existing_advance_original', value)} placeholder="If available" required={false} />
            <InputField label="Lender 2 / Funding Company" value={data.existing_advance_2_funder} onChange={(value) => update('existing_advance_2_funder', value)} placeholder="Second funder" required={false} />
            <InputField label="Current Balance 2" value={data.existing_advance_2_balance} onChange={(value) => update('existing_advance_2_balance', value)} placeholder="Current balance" required={false} />
            <InputField label="Daily / Weekly Payment 2" value={data.existing_advance_2_payment} onChange={(value) => update('existing_advance_2_payment', value)} placeholder="Payment amount" required={false} />
            <InputField label="Original Funding Amount 2" value={data.existing_advance_2_original} onChange={(value) => update('existing_advance_2_original', value)} placeholder="If available" required={false} />
            <InputField label="Lender 3 / Funding Company" value={data.existing_advance_3_funder} onChange={(value) => update('existing_advance_3_funder', value)} placeholder="Third funder" required={false} />
            <InputField label="Current Balance 3" value={data.existing_advance_3_balance} onChange={(value) => update('existing_advance_3_balance', value)} placeholder="Current balance" required={false} />
            <InputField label="Daily / Weekly Payment 3" value={data.existing_advance_3_payment} onChange={(value) => update('existing_advance_3_payment', value)} placeholder="Payment amount" required={false} />
            <InputField label="Original Funding Amount 3" value={data.existing_advance_3_original} onChange={(value) => update('existing_advance_3_original', value)} placeholder="If available" required={false} />
          </div>}
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
  const [bankStatementFiles, setBankStatementFiles] = useState<File[]>([]);
  const [otherDocFiles, setOtherDocFiles] = useState<File[]>([]);
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

  const validateStep = (step: Step) => {
    if (step === 1) {
      if (form.full_name.trim().split(/\s+/).length < 2) return 'Please enter your full name.';
      if (form.home_address.trim().length < 3) return 'Please enter your home street address.';
      if (!form.owner_city.trim()) return 'Please enter your city.';
      if (!form.owner_state.trim()) return 'Please enter your state.';
      if (digitsOnly(form.owner_zip).length < 5) return 'Please enter a valid ZIP code.';
      if (digitsOnly(form.ssn).length !== 9) return 'Please enter a valid 9 digit Social Security Number.';
      if (!form.dob || Number.isNaN(new Date(form.dob).getTime())) return 'Please enter a valid date of birth.';
      if (digitsOnly(form.cell_phone).length !== 10) return 'Please enter a valid 10 digit cell phone number.';
      if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Please enter a valid email address.';
      const ownership = Number(form.ownership_percentage);
      if (!Number.isFinite(ownership) || ownership <= 0 || ownership > 100) return 'Please enter an ownership percentage from 1 to 100.';
      if (hasCoOwnerData(form)) {
        if (form.co_owner_full_name.trim().split(/\s+/).length < 2) return 'Please enter the co-owner full name.';
        if (form.co_owner_home_address.trim().length < 3) return 'Please enter the co-owner home street address.';
        if (!form.co_owner_city.trim()) return 'Please enter the co-owner city.';
        if (!form.co_owner_state.trim()) return 'Please enter the co-owner state.';
        if (digitsOnly(form.co_owner_zip).length < 5) return 'Please enter a valid co-owner ZIP code.';
        if (digitsOnly(form.co_owner_ssn).length !== 9) return 'Please enter a valid 9 digit co-owner Social Security Number.';
        if (!form.co_owner_dob || Number.isNaN(new Date(form.co_owner_dob).getTime())) return 'Please enter a valid co-owner date of birth.';
        if (form.co_owner_cell_phone && digitsOnly(form.co_owner_cell_phone).length !== 10) return 'Please enter a valid 10 digit co-owner cell phone number.';
        if (form.co_owner_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.co_owner_email)) return 'Please enter a valid co-owner email address.';
        const coOwnerOwnership = Number(form.co_owner_ownership_percentage);
        if (!Number.isFinite(coOwnerOwnership) || coOwnerOwnership <= 0 || coOwnerOwnership > 100) return 'Please enter a co-owner ownership percentage from 1 to 100.';
        if (ownership + coOwnerOwnership > 100) return 'Owner and co-owner ownership percentages cannot exceed 100.';
      }
    }
    if (step === 2) {
      if (form.company_name.trim().length < 2) return 'Please enter the company name.';
      if (form.business_address.trim().length < 3) return 'Please enter the business street address.';
      if (!form.business_city.trim()) return 'Please enter the business city.';
      if (!form.business_state.trim()) return 'Please enter the business state.';
      if (digitsOnly(form.business_zip).length < 5) return 'Please enter a valid business ZIP code.';
      if (digitsOnly(form.ein).length !== 9) return 'Please enter a valid 9 digit Tax ID / EIN.';
      if (!form.business_start_date || Number.isNaN(new Date(form.business_start_date).getTime())) return 'Please enter a valid business start date.';
      if (!form.average_monthly_revenue || Number(digitsOnly(form.average_monthly_revenue)) <= 0) return 'Please enter a valid average monthly revenue.';
      if (!form.requested_amount || Number(digitsOnly(form.requested_amount)) <= 0) return 'Please enter a valid amount requested.';
      if (form.industry.trim().length < 2) return 'Please enter the business industry / type.';
      const invalidAdvanceBalance = existingAdvanceRows(form).some((advance) => advance.balance && Number(digitsOnly(advance.balance)) <= 0);
      if (invalidAdvanceBalance) return 'Please enter valid open advance balances.';
    }
    if (step === 3) {
      if (!form.signature_data_url) return 'Please add your signature before submitting.';
      if (!form.consent_accepted) return 'Please accept the consent before submitting.';
    }
    return null;
  };

  const validateAll = () => validateStep(1) || validateStep(2) || validateStep(3);

  const continueStep = () => {
    const error = validateStep(currentStep);
    if (error) {
      trackApplicationEvent('application_validation_error', { field: error });
      toast.error(error);
      return;
    }
    trackApplicationEvent('application_step_completed');
    next();
  };

  const handleSubmit = async () => {
    const error = validateAll();
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

      if (!result.signedApplicationDocumentId) {
        const signatureResponse = await fetch(`/api/applications/${result.applicationId}/signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature_data_url: form.signature_data_url, consent_version: CONSENT_VERSION }),
        });
        const signatureResult = await signatureResponse.json();
        if (!signatureResponse.ok || !signatureResult.success) throw new Error(signatureResult.error || 'Application was saved, but the signed PDF could not be generated. Please contact support.');
      }

      // Optional: attach supporting documents. Never block the application on these uploads.
      if (result.applicationId) {
        const uploadDocs = async (files: File[], documentType: string) => {
          if (!files.length) return;
          const docForm = new FormData();
          docForm.append('document_type', documentType);
          files.forEach((file) => docForm.append('files', file));
          await fetch(`/api/applications/${result.applicationId}/bank-statements`, { method: 'POST', body: docForm });
        };
        try {
          await uploadDocs(bankStatementFiles, 'bank_statement');
          await uploadDocs(otherDocFiles, 'other');
        } catch {
          // Supporting documents are optional — ignore upload errors and continue.
        }
      }

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/elite-funding-logo.png" alt="Elite Funding Solutions" className="mx-auto mb-5 h-20 w-auto" />
          <h1 className="mb-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Elite Funding Solutions Funding Application</h1>
          <p className="text-[16px] leading-7 text-slate-300">Complete the form below to get started.</p>
        </div>
        {referral?.repName && currentStep < 4 && <div className="mx-auto mb-6 max-w-3xl rounded-[10px] border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3 text-center text-sm font-semibold text-[#f1d08a]">Your application is connected to {referral.repName}.</div>}
        <div className="premium-card p-5 md:p-8">
          {currentStep === 4 ? (
            <StepConfirmation />
          ) : (
            <div className="space-y-8">
              <StepBusiness data={form} update={updateField} />
              <StepAboutYou data={form} update={updateField} />
              <div className="application-disclosure-copy rounded-[12px] border border-[#CBD5E1] bg-white p-4 text-[#0F172A] shadow-sm">
                <h3 className="text-[15px] font-semibold text-[#0F2B5B]">Supporting documents (optional)</h3>
                <p className="mt-1 text-[13px] text-[#475569]">Please upload your last 4 months of business bank statements and your month-to-date statement. This is optional — you can submit now and send these later.</p>
                <label className="mt-3 block text-[13px] font-semibold text-[#334155]">Bank statements (last 4 months + month-to-date)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                  data-testid="application-bank-statements"
                  onChange={(event) => setBankStatementFiles(Array.from(event.target.files || []).slice(0, 8))}
                  className="mt-1.5 block w-full text-sm text-[#0F172A] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#0F2B5B] file:px-3 file:py-2 file:text-white"
                />
                {bankStatementFiles.length > 0 && (
                  <p className="mt-1.5 text-[12px] text-[#475569]">{bankStatementFiles.length} bank statement file{bankStatementFiles.length === 1 ? '' : 's'} selected</p>
                )}
                <label className="mt-4 block text-[13px] font-semibold text-[#334155]">Other documents (driver&apos;s license, tax documents, A/R reports, etc.)</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                  data-testid="application-other-documents"
                  onChange={(event) => setOtherDocFiles(Array.from(event.target.files || []).slice(0, 8))}
                  className="mt-1.5 block w-full text-sm text-[#0F172A] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#475569] file:px-3 file:py-2 file:text-white"
                />
                {otherDocFiles.length > 0 && (
                  <p className="mt-1.5 text-[12px] text-[#475569]">{otherDocFiles.length} other document{otherDocFiles.length === 1 ? '' : 's'} selected</p>
                )}
                <p className="mt-2 text-[12px] text-[#94A3B8]">PDF, JPG, or PNG · up to 10MB each.</p>
              </div>
              <SignaturePad value={form.signature_data_url} onChange={(value) => updateField('signature_data_url', value)} />
              <div className="application-disclosure-copy rounded-[12px] border border-[#CBD5E1] bg-white p-4 text-[#0F172A] shadow-sm md:p-5">
                <div className="mb-4 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] p-4">
                  <h3 className="text-[16px] font-semibold text-[#0F2B5B]">Important Application Authorization</h3>
                  <p className="mt-2 text-[14px] font-semibold leading-[1.6] text-[#0F172A]">Please read these disclosures before submitting. They explain what Elite Funding Solutions and its funding partners may review, how consent is recorded, and how your information may be used.</p>
                </div>
                <div className="grid gap-4">
                  {APPLICATION_DISCLOSURE_SECTIONS.map((section) => (
                    <section key={section.title} className="rounded-[10px] border border-[#CBD5E1] bg-white p-4">
                      <h3 className="text-[15px] font-bold text-[#0F2B5B]">{section.title}</h3>
                      <div className="mt-2 space-y-3">
                        {section.paragraphs.map((paragraph) => (<p key={paragraph} className="text-[13px] font-medium leading-[1.6] text-[#0F172A]">{paragraph}</p>))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
              <label className="application-disclosure-copy flex cursor-pointer gap-3 rounded-[10px] border border-[#64748B] bg-white p-4 shadow-sm">
                <input type="checkbox" checked={form.consent_accepted} onChange={(event) => updateField('consent_accepted', event.target.checked)} className="mt-1 h-5 w-5 shrink-0 rounded border-[#475569]" />
                <span className="text-[14px] font-medium leading-[1.6] text-[#0F172A]">
                  <strong className="font-bold text-[#0F2B5B]">E-Sign and TCPA Consent:</strong> I authorize Elite Funding Solutions and its funding partners to send legally required notices electronically to the email address provided on this application. I also authorize Elite Funding Solutions and any lender or funding partner receiving this application to contact me by telephone, text message, or email regarding business funding options at the phone number and email address provided, including through automated technology, even if my number is listed on a federal, state, or corporate do-not-call registry. <strong className="font-semibold">I agree to the E-Sign and TCPA Consent.</strong>
                </span>
              </label>
              <input type="text" value={form.bot_field} onChange={(event) => updateField('bot_field', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div className="rounded-[10px] border border-[#DDE3EF] bg-[#F8F9FB] p-4 text-sm font-semibold text-[#0A1628]">
                <Shield className="mr-2 inline h-4 w-4 text-[#0F2B5B]" /> SSN, DOB, Tax ID, and signature are encrypted or protected before storage.
              </div>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#061326] px-5 text-[15px] font-semibold text-white transition-all hover:bg-[#0A1730] disabled:opacity-50">
                {submitting ? 'Submitting application...' : 'Submit Application'} {!submitting && <CheckCircle2 className="h-4 w-4" />}
              </button>
              <p className="text-center text-[12px] leading-5 text-[#475569]">By submitting this form, you agree to allow Elite Funding Solutions to review your business and owner information for funding eligibility.</p>
            </div>
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
