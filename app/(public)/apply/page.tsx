'use client';

import { useState } from 'react';
import { CircleCheck as CheckCircle2, ArrowRight, ArrowLeft, Shield, Lock } from 'lucide-react';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Step types ────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface FormData {
  // Step 1 – Business
  legal_name: string;
  dba: string;
  entity_type: string;
  ein: string;
  industry: string;
  naics_code: string;
  start_date: string;
  business_phone: string;
  business_email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  monthly_gross_revenue: string;
  average_daily_balance: string;
  deposit_count: string;
  current_processor: string;
  landlord_name: string;
  landlord_phone: string;
  rent_amount: string;
  has_tax_lien: boolean;
  has_bankruptcy: boolean;

  // Step 2 – Owner
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  ssn_last4: string;
  ownership_pct: string;
  credit_range: string;
  home_address: string;
  home_city: string;
  home_state: string;
  home_zip: string;

  // Step 3 – Funding Request
  requested_amount: string;
  use_of_funds: string;
  timeline: string;
  has_existing_advances: boolean;
  payment_frequency: string;
  notes: string;

  // Step 4 – Existing Advances
  existing_advances: Array<{
    funder_name: string;
    original_amount: string;
    current_balance: string;
    daily_payment: string;
    payment_frequency: string;
    notes: string;
  }>;

  // Step 5 – Bank Info
  bank_name: string;
  account_type: string;
  routing_number: string;
  account_last4: string;
  avg_monthly_deposits: string;
  negative_days: string;
  nsf_count: string;
  ending_balance: string;
}

const initialForm: FormData = {
  legal_name: '', dba: '', entity_type: '', ein: '', industry: '',
  naics_code: '', start_date: '', business_phone: '', business_email: '',
  website: '', address: '', city: '', state: '', zip: '',
  monthly_gross_revenue: '', average_daily_balance: '', deposit_count: '',
  current_processor: '', landlord_name: '', landlord_phone: '', rent_amount: '',
  has_tax_lien: false, has_bankruptcy: false,
  first_name: '', last_name: '', email: '', phone: '', dob: '', ssn_last4: '',
  ownership_pct: '100', credit_range: '',
  home_address: '', home_city: '', home_state: '', home_zip: '',
  requested_amount: '', use_of_funds: '', timeline: '',
  has_existing_advances: false, payment_frequency: '', notes: '',
  existing_advances: [],
  bank_name: '', account_type: '', routing_number: '', account_last4: '',
  avg_monthly_deposits: '', negative_days: '0', nsf_count: '0', ending_balance: '',
};

const steps = [
  { number: 1, title: 'Business Information' },
  { number: 2, title: 'Owner Information' },
  { number: 3, title: 'Funding Request' },
  { number: 4, title: 'Existing Advances' },
  { number: 5, title: 'Bank Information' },
  { number: 6, title: 'Document Upload' },
  { number: 7, title: 'Review & Submit' },
  { number: 8, title: 'Confirmation' },
];

const usStates = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

// ─── Input helpers ─────────────────────────────────────────────────────────
function InputField({
  label, name, value, onChange, type = 'text', placeholder = '', required = false, hint = ''
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">
        {label} {required && <span className="text-[#EF4444]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field w-full"
        required={required}
      />
      {hint && <p className="text-[12px] text-[#A1A1AA] mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, name, value, onChange, options, required = false
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">
        {label} {required && <span className="text-[#EF4444]">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full appearance-none bg-white"
        required={required}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Step 1 – Business ─────────────────────────────────────────────────────
function StepBusiness({ data, update }: { data: FormData; update: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Business Information</h2>
        <p className="text-[14px] text-[#71717A]">Tell us about the business seeking funding.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <InputField label="Legal Business Name" name="legal_name" value={data.legal_name} onChange={(v) => update('legal_name', v)} required placeholder="Acme Restaurant LLC" />
        </div>
        <InputField label="DBA (Doing Business As)" name="dba" value={data.dba} onChange={(v) => update('dba', v)} placeholder="If different from legal name" />
        <SelectField label="Entity Type" name="entity_type" value={data.entity_type} onChange={(v) => update('entity_type', v)} required options={[
          { value: 'llc', label: 'LLC' },
          { value: 'sole_proprietor', label: 'Sole Proprietorship' },
          { value: 's_corp', label: 'S Corporation' },
          { value: 'c_corp', label: 'C Corporation' },
          { value: 'partnership', label: 'Partnership' },
          { value: 'non_profit', label: 'Non-Profit' },
          { value: 'other', label: 'Other' },
        ]} />
        <InputField label="EIN (Federal Tax ID)" name="ein" value={data.ein} onChange={(v) => update('ein', v)} placeholder="XX-XXXXXXX" hint="Kept confidential and encrypted" />
        <SelectField label="Industry" name="industry" value={data.industry} onChange={(v) => update('industry', v)} required options={[
          { value: 'Restaurant', label: 'Restaurant / Food Service' },
          { value: 'Retail', label: 'Retail' },
          { value: 'Healthcare', label: 'Healthcare' },
          { value: 'Construction', label: 'Construction' },
          { value: 'Transportation', label: 'Transportation / Logistics' },
          { value: 'Automotive', label: 'Automotive' },
          { value: 'Technology', label: 'Technology' },
          { value: 'Professional Services', label: 'Professional Services' },
          { value: 'Manufacturing', label: 'Manufacturing' },
          { value: 'Other', label: 'Other' },
        ]} />
        <InputField label="Business Start Date" name="start_date" value={data.start_date} onChange={(v) => update('start_date', v)} type="date" required />
        <InputField label="Business Phone" name="business_phone" value={data.business_phone} onChange={(v) => update('business_phone', v)} type="tel" placeholder="(XXX) XXX-XXXX" required />
        <InputField label="Business Email" name="business_email" value={data.business_email} onChange={(v) => update('business_email', v)} type="email" placeholder="owner@yourbusiness.com" required />
        <InputField label="Website" name="website" value={data.website} onChange={(v) => update('website', v)} placeholder="https://yourbusiness.com" />
        <div className="md:col-span-2">
          <InputField label="Business Address" name="address" value={data.address} onChange={(v) => update('address', v)} placeholder="123 Main Street" required />
        </div>
        <InputField label="City" name="city" value={data.city} onChange={(v) => update('city', v)} required />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="State" name="state" value={data.state} onChange={(v) => update('state', v)} required options={usStates.map(s => ({ value: s, label: s }))} />
          <InputField label="ZIP Code" name="zip" value={data.zip} onChange={(v) => update('zip', v)} required />
        </div>
      </div>

      <div className="border-t border-[#F4F4F5] pt-5">
        <h3 className="text-[15px] font-semibold text-[#09090B] mb-4">Revenue & Banking Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Monthly Gross Revenue" name="monthly_gross_revenue" value={data.monthly_gross_revenue} onChange={(v) => update('monthly_gross_revenue', v)} type="number" placeholder="0" required hint="Average over last 3 months" />
          <InputField label="Average Daily Balance" name="average_daily_balance" value={data.average_daily_balance} onChange={(v) => update('average_daily_balance', v)} type="number" placeholder="0" />
          <InputField label="Monthly Deposit Count" name="deposit_count" value={data.deposit_count} onChange={(v) => update('deposit_count', v)} type="number" placeholder="0" />
        </div>
      </div>

      <div className="border-t border-[#F4F4F5] pt-5">
        <h3 className="text-[15px] font-semibold text-[#09090B] mb-4">Landlord Information (if applicable)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Landlord Name" name="landlord_name" value={data.landlord_name} onChange={(v) => update('landlord_name', v)} />
          <InputField label="Landlord Phone" name="landlord_phone" value={data.landlord_phone} onChange={(v) => update('landlord_phone', v)} type="tel" />
          <InputField label="Monthly Rent" name="rent_amount" value={data.rent_amount} onChange={(v) => update('rent_amount', v)} type="number" placeholder="0" />
        </div>
      </div>

      <div className="border-t border-[#F4F4F5] pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={data.has_tax_lien} onChange={(e) => update('has_tax_lien', e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-[#E4E4E7] text-[#2563EB]" />
          <span className="text-[14px] text-[#52525B]">The business has an open tax lien</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={data.has_bankruptcy} onChange={(e) => update('has_bankruptcy', e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-[#E4E4E7] text-[#2563EB]" />
          <span className="text-[14px] text-[#52525B]">The business has open or recent bankruptcy</span>
        </label>
      </div>
    </div>
  );
}

// ─── Step 2 – Owner ────────────────────────────────────────────────────────
function StepOwner({ data, update }: { data: FormData; update: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Owner Information</h2>
        <p className="text-[14px] text-[#71717A]">Information about the primary business owner.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="First Name" name="first_name" value={data.first_name} onChange={(v) => update('first_name', v)} required />
        <InputField label="Last Name" name="last_name" value={data.last_name} onChange={(v) => update('last_name', v)} required />
        <InputField label="Email Address" name="email" value={data.email} onChange={(v) => update('email', v)} type="email" required />
        <InputField label="Mobile Phone" name="phone" value={data.phone} onChange={(v) => update('phone', v)} type="tel" required />
        <InputField label="Date of Birth" name="dob" value={data.dob} onChange={(v) => update('dob', v)} type="date" required hint="Kept confidential and encrypted" />
        <InputField label="SSN Last 4 Digits" name="ssn_last4" value={data.ssn_last4} onChange={(v) => update('ssn_last4', v)} placeholder="XXXX" hint="We never store your full SSN" />
        <InputField label="Ownership Percentage" name="ownership_pct" value={data.ownership_pct} onChange={(v) => update('ownership_pct', v)} type="number" placeholder="100" hint="Enter 100 if sole owner" />
        <SelectField label="Credit Score Range" name="credit_range" value={data.credit_range} onChange={(v) => update('credit_range', v)} options={[
          { value: 'below_500', label: 'Below 500' },
          { value: '500_549', label: '500 – 549' },
          { value: '550_599', label: '550 – 599' },
          { value: '600_649', label: '600 – 649' },
          { value: '650_699', label: '650 – 699' },
          { value: '700_749', label: '700 – 749' },
          { value: '750_plus', label: '750+' },
        ]} />
        <div className="md:col-span-2">
          <InputField label="Home Address" name="home_address" value={data.home_address} onChange={(v) => update('home_address', v)} required />
        </div>
        <InputField label="City" name="home_city" value={data.home_city} onChange={(v) => update('home_city', v)} required />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="State" name="home_state" value={data.home_state} onChange={(v) => update('home_state', v)} required options={usStates.map(s => ({ value: s, label: s }))} />
          <InputField label="ZIP" name="home_zip" value={data.home_zip} onChange={(v) => update('home_zip', v)} required />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 – Funding Request ──────────────────────────────────────────────
function StepFunding({ data, update }: { data: FormData; update: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Funding Request</h2>
        <p className="text-[14px] text-[#71717A]">Tell us how much you need and how you plan to use it.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Requested Funding Amount" name="requested_amount" value={data.requested_amount} onChange={(v) => update('requested_amount', v)} type="number" required placeholder="50000" hint="Minimum $10,000 • Maximum $5,000,000" />
        <SelectField label="Preferred Payment Frequency" name="payment_frequency" value={data.payment_frequency} onChange={(v) => update('payment_frequency', v)} options={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'bi_weekly', label: 'Bi-Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ]} />
        <SelectField label="Use of Funds" name="use_of_funds" value={data.use_of_funds} onChange={(v) => update('use_of_funds', v)} required options={[
          { value: 'Working Capital', label: 'Working Capital' },
          { value: 'Inventory Purchase', label: 'Inventory Purchase' },
          { value: 'Equipment Purchase', label: 'Equipment Purchase' },
          { value: 'Payroll', label: 'Payroll' },
          { value: 'Marketing & Advertising', label: 'Marketing & Advertising' },
          { value: 'Expansion / Renovation', label: 'Expansion / Renovation' },
          { value: 'Debt Consolidation', label: 'Debt Consolidation' },
          { value: 'Tax Payment', label: 'Tax Payment' },
          { value: 'Other', label: 'Other' },
        ]} />
        <SelectField label="Desired Funding Timeline" name="timeline" value={data.timeline} onChange={(v) => update('timeline', v)} options={[
          { value: 'ASAP', label: 'As soon as possible' },
          { value: '1_week', label: 'Within 1 week' },
          { value: '2_weeks', label: 'Within 2 weeks' },
          { value: '30_days', label: 'Within 30 days' },
        ]} />
        <div className="md:col-span-2">
          <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">Additional Notes</label>
          <textarea
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any context that would help your advisor..."
            rows={3}
            className="w-full bg-white border border-[#E4E4E7] rounded-[10px] px-[14px] py-3 text-[15px] text-[#09090B] placeholder-[#A1A1AA] resize-none focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#EFF6FF] transition-all"
          />
        </div>
      </div>

      <div className="border border-[#E4E4E7] rounded-[12px] p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.has_existing_advances}
            onChange={(e) => update('has_existing_advances', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#E4E4E7] text-[#2563EB]"
          />
          <div>
            <span className="text-[14px] font-medium text-[#09090B]">I have existing merchant cash advances or business loans</span>
            <p className="text-[13px] text-[#71717A] mt-0.5">Check this if you currently have any outstanding advances, business loans, or lines of credit.</p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Step 4 – Existing Advances ────────────────────────────────────────────
function StepExistingAdvances({ data, update }: { data: FormData; update: (k: keyof FormData, v: FormData['existing_advances']) => void }) {
  const advances = data.existing_advances;

  const addAdvance = () => {
    update('existing_advances', [...advances, {
      funder_name: '', original_amount: '', current_balance: '',
      daily_payment: '', payment_frequency: '', notes: ''
    }]);
  };

  const removeAdvance = (i: number) => {
    update('existing_advances', advances.filter((_, idx) => idx !== i));
  };

  const updateAdvance = (i: number, field: string, value: string) => {
    const updated = advances.map((a, idx) => idx === i ? { ...a, [field]: value } : a);
    update('existing_advances', updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Existing Advances</h2>
        <p className="text-[14px] text-[#71717A]">
          {data.has_existing_advances
            ? 'List all current outstanding advances, loans, or lines of credit.'
            : 'You indicated no existing advances. Skip to the next step or add one below.'}
        </p>
      </div>

      {advances.length === 0 && (
        <div className="border-2 border-dashed border-[#E4E4E7] rounded-[12px] p-8 text-center">
          <p className="text-[14px] text-[#A1A1AA] mb-3">No existing advances added</p>
          <button
            type="button"
            onClick={addAdvance}
            className="inline-flex items-center gap-2 text-[14px] font-medium text-[#2563EB] hover:underline"
          >
            + Add an existing advance
          </button>
        </div>
      )}

      {advances.map((adv, i) => (
        <div key={i} className="border border-[#E4E4E7] rounded-[12px] p-5 relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-[#09090B]">Advance #{i + 1}</h3>
            <button
              type="button"
              onClick={() => removeAdvance(i)}
              className="text-[13px] text-[#EF4444] hover:underline"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Funder Name" name={`funder_${i}`} value={adv.funder_name} onChange={(v) => updateAdvance(i, 'funder_name', v)} placeholder="e.g. Rapid Capital Funding" />
            <InputField label="Original Funded Amount" name={`orig_${i}`} value={adv.original_amount} onChange={(v) => updateAdvance(i, 'original_amount', v)} type="number" />
            <InputField label="Current Balance" name={`bal_${i}`} value={adv.current_balance} onChange={(v) => updateAdvance(i, 'current_balance', v)} type="number" />
            <InputField label="Daily / Weekly Payment" name={`pmt_${i}`} value={adv.daily_payment} onChange={(v) => updateAdvance(i, 'daily_payment', v)} type="number" />
            <SelectField label="Payment Frequency" name={`freq_${i}`} value={adv.payment_frequency} onChange={(v) => updateAdvance(i, 'payment_frequency', v)} options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'bi_weekly', label: 'Bi-Weekly' },
            ]} />
          </div>
        </div>
      ))}

      {advances.length > 0 && (
        <button
          type="button"
          onClick={addAdvance}
          className="text-[14px] font-medium text-[#2563EB] hover:underline"
        >
          + Add another advance
        </button>
      )}
    </div>
  );
}

// ─── Step 5 – Bank Info ────────────────────────────────────────────────────
function StepBank({ data, update }: { data: FormData; update: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Bank Information</h2>
        <p className="text-[14px] text-[#71717A]">Tell us about your primary business checking account.</p>
      </div>

      <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-[10px] px-4 py-3 flex items-center gap-3">
        <Lock className="w-4 h-4 text-[#2563EB] shrink-0" />
        <p className="text-[13px] text-[#2563EB]">Your bank information is encrypted and only used to verify account ownership. We never store full account numbers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Bank Name" name="bank_name" value={data.bank_name} onChange={(v) => update('bank_name', v)} required placeholder="Chase, Bank of America, etc." />
        <SelectField label="Account Type" name="account_type" value={data.account_type} onChange={(v) => update('account_type', v)} options={[
          { value: 'checking', label: 'Business Checking' },
          { value: 'savings', label: 'Business Savings' },
        ]} />
        <InputField label="Routing Number" name="routing_number" value={data.routing_number} onChange={(v) => update('routing_number', v)} placeholder="9-digit routing number" />
        <InputField label="Account Last 4 Digits" name="account_last4" value={data.account_last4} onChange={(v) => update('account_last4', v)} placeholder="XXXX" hint="Last 4 digits only" />
        <InputField label="Average Monthly Deposits" name="avg_monthly_deposits" value={data.avg_monthly_deposits} onChange={(v) => update('avg_monthly_deposits', v)} type="number" placeholder="0" />
        <InputField label="Estimated Ending Balance" name="ending_balance" value={data.ending_balance} onChange={(v) => update('ending_balance', v)} type="number" placeholder="0" hint="Current approximate balance" />
        <InputField label="Negative Days (last 3 months)" name="negative_days" value={data.negative_days} onChange={(v) => update('negative_days', v)} type="number" placeholder="0" hint="Days the account went negative" />
        <InputField label="NSF Count (last 3 months)" name="nsf_count" value={data.nsf_count} onChange={(v) => update('nsf_count', v)} type="number" placeholder="0" hint="Number of returned / insufficient fund items" />
      </div>
    </div>
  );
}

// ─── Step 6 – Document Upload ─────────────────────────────────────────────
function StepDocuments() {
  const docs = [
    { id: 'bank_statements', label: 'Last 3 Bank Statements', required: true, description: 'All pages of your last 3 complete months' },
    { id: 'drivers_license', label: "Driver's License or State ID", required: true, description: 'Front and back of government-issued photo ID' },
    { id: 'voided_check', label: 'Voided Check', required: true, description: 'Voided check for the business checking account' },
    { id: 'processing_statements', label: 'Processing Statements', required: false, description: 'Last 3 months if you accept credit cards' },
    { id: 'business_tax_returns', label: 'Business Tax Returns', required: false, description: 'Most recent year, if available' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Document Upload</h2>
        <p className="text-[14px] text-[#71717A]">Securely upload your supporting documents. You can also email them to your advisor after applying.</p>
      </div>

      <div className="flex flex-col gap-3">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="border border-[#E4E4E7] rounded-[12px] p-4 flex items-start gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[14px] font-medium text-[#09090B]">{doc.label}</span>
                {doc.required && (
                  <span className="badge-brand text-[11px]">Required</span>
                )}
              </div>
              <p className="text-[12px] text-[#71717A]">{doc.description}</p>
            </div>
            <div>
              <label className="inline-flex items-center gap-2 rounded-[8px] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#09090B] font-medium text-[13px] h-9 px-4 cursor-pointer transition-colors">
                <span>Choose File</span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.heic" multiple />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] px-5 py-4">
        <p className="text-[13px] text-[#71717A]">
          <strong className="text-[#52525B]">Accepted formats:</strong> PDF, JPG, PNG, HEIC &nbsp;&bull;&nbsp;
          <strong className="text-[#52525B]">Max size:</strong> 25MB per file &nbsp;&bull;&nbsp;
          Documents are stored encrypted in a private, access-controlled vault.
        </p>
      </div>
    </div>
  );
}

// ─── Step 7 – Review ───────────────────────────────────────────────────────
function StepReview({ data }: { data: FormData }) {
  const sections = [
    {
      title: 'Business',
      fields: [
        ['Legal Name', data.legal_name],
        ['DBA', data.dba || '—'],
        ['Entity Type', data.entity_type],
        ['Industry', data.industry],
        ['Business Start Date', data.start_date],
        ['Monthly Revenue', data.monthly_gross_revenue ? `$${Number(data.monthly_gross_revenue).toLocaleString()}` : '—'],
        ['Location', `${data.city}, ${data.state} ${data.zip}`],
      ],
    },
    {
      title: 'Owner',
      fields: [
        ['Name', `${data.first_name} ${data.last_name}`],
        ['Email', data.email],
        ['Phone', data.phone],
        ['Credit Range', data.credit_range],
        ['Ownership', `${data.ownership_pct}%`],
      ],
    },
    {
      title: 'Funding Request',
      fields: [
        ['Amount Requested', data.requested_amount ? `$${Number(data.requested_amount).toLocaleString()}` : '—'],
        ['Use of Funds', data.use_of_funds],
        ['Timeline', data.timeline],
        ['Payment Frequency', data.payment_frequency],
      ],
    },
    {
      title: 'Bank',
      fields: [
        ['Bank Name', data.bank_name],
        ['Account Type', data.account_type],
        ['Account Last 4', data.account_last4 ? `****${data.account_last4}` : '—'],
        ['Avg Monthly Deposits', data.avg_monthly_deposits ? `$${Number(data.avg_monthly_deposits).toLocaleString()}` : '—'],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[#09090B] mb-1">Review Your Application</h2>
        <p className="text-[14px] text-[#71717A]">Please review your information before submitting.</p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="border border-[#E4E4E7] rounded-[12px] overflow-hidden">
          <div className="bg-[#F4F4F5] px-5 py-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]">{section.title}</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.fields.map(([label, value]) => (
              <div key={label}>
                <div className="text-[12px] text-[#A1A1AA] mb-0.5">{label}</div>
                <div className="text-[14px] font-medium text-[#09090B]">{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="border border-[#E4E4E7] rounded-[12px] p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" required className="mt-0.5 w-4 h-4 rounded border-[#E4E4E7]" />
          <p className="text-[13px] text-[#71717A] leading-relaxed">
            By submitting this application, I certify that all information provided is accurate and complete. I authorize Elite Funding Solutions to conduct a soft credit inquiry and to share this application with funding partners on my behalf. I have read and agree to the{' '}
            <a href="/terms" className="text-[#2563EB] hover:underline">Terms of Service</a> and{' '}
            <a href="/privacy" className="text-[#2563EB] hover:underline">Privacy Policy</a>.
          </p>
        </label>
      </div>
    </div>
  );
}

// ─── Step 8 – Confirmation ─────────────────────────────────────────────────
function StepConfirmation({ data }: { data: FormData }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
      </div>
      <h2 className="text-[26px] font-bold text-[#09090B] mb-3">Application Submitted!</h2>
      <p className="text-[16px] text-[#71717A] max-w-[420px] mx-auto leading-relaxed mb-8">
        Thank you, {data.first_name}. Your application has been received. A funding advisor will contact you within 4 business hours at{' '}
        <strong className="text-[#09090B]">{data.email}</strong>.
      </p>

      <div className="max-w-[400px] mx-auto bg-[#FAFAFA] border border-[#E4E4E7] rounded-[16px] p-6 text-left mb-8">
        <h3 className="text-[15px] font-semibold text-[#09090B] mb-4">What happens next</h3>
        <div className="flex flex-col gap-3">
          {[
            { step: '1', text: 'Your advisor reviews your application and documents' },
            { step: '2', text: 'We shop your deal across 50+ funding partners' },
            { step: '3', text: 'You receive one or more competing offers' },
            { step: '4', text: 'You choose the best offer and e-sign your contract' },
            { step: '5', text: 'Funds are wired directly to your business account' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <span className="text-[14px] text-[#52525B]">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <a
        href="/portal"
        className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all"
        style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628' }}
      >
        Access Your Client Portal
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Main Application Page ──────────────────────────────────────────────────
export default function ApplyPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof FormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => setCurrentStep((s) => Math.min(s + 1, 8) as Step);
  const back = () => setCurrentStep((s) => Math.max(s - 1, 1) as Step);

  const handleSubmit = async () => {
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    try {
      // Insert business
      const { data: biz, error: bizErr } = await db
        .from('businesses')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          legal_name: form.legal_name,
          dba: form.dba || null,
          entity_type: form.entity_type as never || null,
          industry: form.industry || null,
          start_date: form.start_date || null,
          phone: form.business_phone || null,
          email: form.business_email || null,
          website: form.website || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          monthly_gross_revenue: form.monthly_gross_revenue ? Number(form.monthly_gross_revenue) : null,
          average_daily_balance: form.average_daily_balance ? Number(form.average_daily_balance) : null,
          deposit_count_monthly: form.deposit_count ? Number(form.deposit_count) : null,
          rent_amount: form.rent_amount ? Number(form.rent_amount) : null,
          has_tax_lien: form.has_tax_lien,
          has_bankruptcy: form.has_bankruptcy,
        })
        .select('id')
        .single();

      if (bizErr) throw bizErr;

      // Insert owner
      const { data: owner, error: ownerErr } = await db
        .from('owners')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          ssn_last4: form.ssn_last4 || null,
          ownership_percentage: form.ownership_pct ? Number(form.ownership_pct) : null,
          credit_score_range: form.credit_range as never || null,
          address: form.home_address || null,
          city: form.home_city || null,
          state: form.home_state || null,
          zip: form.home_zip || null,
        })
        .select('id')
        .single();

      if (ownerErr) throw ownerErr;

      // Link owner to business
      await db.from('business_owners').insert({
        organization_id: DEFAULT_ORG_ID,
        business_id: biz.id,
        owner_id: owner.id,
        ownership_percentage: form.ownership_pct ? Number(form.ownership_pct) : null,
        is_primary: true,
      });

      // Insert application
      const { data: app, error: appErr } = await db
        .from('applications')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          business_id: biz.id,
          status: 'submitted',
          requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
          use_of_funds: form.use_of_funds || null,
          desired_timeline: form.timeline || null,
          has_existing_advances: form.has_existing_advances,
          desired_payment_frequency: form.payment_frequency as never || null,
          notes: form.notes || null,
          bank_name: form.bank_name || null,
          account_type: form.account_type as never || null,
          routing_number: form.routing_number || null,
          account_last4: form.account_last4 || null,
          avg_monthly_deposits: form.avg_monthly_deposits ? Number(form.avg_monthly_deposits) : null,
          negative_days_count: Number(form.negative_days) || 0,
          nsf_count: Number(form.nsf_count) || 0,
          ending_balance_estimate: form.ending_balance ? Number(form.ending_balance) : null,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (appErr) throw appErr;

      // Insert existing advances
      if (form.existing_advances.length > 0) {
        await db.from('existing_advances').insert(
          form.existing_advances.map((adv) => ({
            organization_id: DEFAULT_ORG_ID,
            application_id: app.id,
            funder_name: adv.funder_name || null,
            original_funded_amount: adv.original_amount ? Number(adv.original_amount) : null,
            current_balance: adv.current_balance ? Number(adv.current_balance) : null,
            daily_payment: adv.daily_payment ? Number(adv.daily_payment) : null,
            payment_frequency: adv.payment_frequency as never || null,
          }))
        );
      }

      // Insert lead
      await db.from('leads').insert({
        organization_id: DEFAULT_ORG_ID,
        lead_source: 'website',
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        business_name: form.legal_name,
        status: 'application_started',
      });

      setCurrentStep(8);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = currentStep === 7;
  const progressPct = ((currentStep - 1) / 7) * 100;

  return (
    <div className="min-h-screen bg-[#F8F9FB] pt-8 pb-20">
      <div className="max-w-[760px] mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-[#0A1628] tracking-tight mb-2">Apply for Business Funding</h1>
          <p className="text-[15px] text-[#5A6A85]">No obligation. Decisions in as little as 4 hours.</p>
        </div>

        {/* Progress bar */}
        {currentStep < 8 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-[#52525B]">
                Step {currentStep} of 7: {steps[currentStep - 1].title}
              </span>
              <span className="text-[13px] text-[#A1A1AA]">{Math.round(progressPct)}% complete</span>
            </div>
            <div className="h-1.5 bg-[#E4E4E7] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ background: 'linear-gradient(90deg, #0F2B5B, #C9A84C)', width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-8" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          {currentStep === 1 && <StepBusiness data={form} update={updateField as never} />}
          {currentStep === 2 && <StepOwner data={form} update={updateField as never} />}
          {currentStep === 3 && <StepFunding data={form} update={updateField as never} />}
          {currentStep === 4 && <StepExistingAdvances data={form} update={updateField as never} />}
          {currentStep === 5 && <StepBank data={form} update={updateField as never} />}
          {currentStep === 6 && <StepDocuments />}
          {currentStep === 7 && <StepReview data={form} />}
          {currentStep === 8 && <StepConfirmation data={form} />}

          {/* Navigation */}
          {currentStep < 8 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#F4F4F5]">
              <button
                type="button"
                onClick={back}
                disabled={currentStep === 1}
                className={`inline-flex items-center gap-2 text-[14px] font-medium px-4 py-2 rounded-[8px] transition-colors ${
                  currentStep === 1
                    ? 'text-[#A1A1AA] cursor-not-allowed'
                    : 'text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F5]'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center gap-2">
                {/* Step dots */}
                {steps.slice(0, 7).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all ${
                      i + 1 === currentStep
                        ? 'w-6 h-2 bg-[#0F2B5B]'
                        : i + 1 < currentStep
                        ? 'w-2 h-2 bg-[#10B981]'
                        : 'w-2 h-2 bg-[#E4E4E7]'
                    }`}
                  />
                ))}
              </div>

              {isLastStep ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#10B981] text-white font-semibold text-[14px] h-10 px-5 transition-all hover:bg-[#059669] disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Application'}
                  {!submitting && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-[10px] text-white font-semibold text-[14px] h-10 px-5 transition-all" style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628' }}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Security note */}
        {currentStep < 8 && (
          <div className="flex items-center justify-center gap-2 mt-5 text-[12px] text-[#A1A1AA]">
            <Shield className="w-3.5 h-3.5" />
            <span>256-bit SSL encryption. Your data is never sold or shared without consent.</span>
          </div>
        )}
      </div>
    </div>
  );
}
