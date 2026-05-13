'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Shield, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { CONSENT_VERSION } from '@/lib/company';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type OwnerKey = 'owner1' | 'owner2';
type DocumentKey = 'bank_statements';

interface OwnerFields {
  first_name: string;
  last_name: string;
  title: string;
  ownership_pct: string;
  email: string;
  phone: string;
  mobile: string;
  dob: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  credit_range: string;
}

interface ExistingAdvance {
  funder_name: string;
  original_amount: string;
  current_balance: string;
  daily_payment: string;
  payment_frequency: string;
  notes: string;
}

interface ApplicationFormData {
  legal_name: string;
  dba: string;
  entity_type: string;
  ein: string;
  merchant_type: string;
  industry: string;
  start_date: string;
  business_phone: string;
  business_mobile: string;
  fax: string;
  business_email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  business_location: string;
  products_services: string;
  pos_contact_name: string;
  pos_contact_phone: string;
  pos_system: string;
  has_judgments: boolean;
  has_tax_lien: boolean;
  has_bankruptcy: boolean;
  is_seasonal: boolean;
  bank_name: string;
  bank_contact: string;
  bank_phone: string;
  account_type: string;
  owner1: OwnerFields;
  owner2: OwnerFields;
  requested_amount: string;
  use_of_funds: string;
  timeline: string;
  average_monthly_sales: string;
  average_visa_mc_sales: string;
  monthly_gross_revenue: string;
  has_existing_advances: boolean;
  existing_advances: ExistingAdvance[];
  notes: string;
  certification_accepted: boolean;
  credit_authorization_accepted: boolean;
  esign_consent_accepted: boolean;
  sms_consent_accepted: boolean;
  terms_accepted: boolean;
  privacy_policy_accepted: boolean;
  authorization_consent: boolean;
  sms_consent: boolean;
  signature: string;
  signature_date: string;
  bot_field: string;
}

const blankOwner: OwnerFields = {
  first_name: '', last_name: '', title: '', ownership_pct: '', email: '', phone: '', mobile: '', dob: '', ssn: '', address: '', city: '', state: '', zip: '', credit_range: '',
};

const initialForm: ApplicationFormData = {
  legal_name: '', dba: '', entity_type: '', ein: '', merchant_type: '', industry: '', start_date: '',
  business_phone: '', business_mobile: '', fax: '', business_email: '', website: '', address: '', city: '', state: '', zip: '', business_location: '', products_services: '',
  pos_contact_name: '', pos_contact_phone: '', pos_system: '', has_judgments: false, has_tax_lien: false, has_bankruptcy: false, is_seasonal: false,
  reference1_name: '', reference1_phone: '', reference2_name: '', reference2_phone: '',
  bank_name: '', bank_contact: '', bank_phone: '', account_last4: '', account_type: 'checking',
  owner1: { ...blankOwner, ownership_pct: '100' }, owner2: { ...blankOwner },
  requested_amount: '', use_of_funds: '', timeline: '', average_monthly_sales: '', average_visa_mc_sales: '', monthly_gross_revenue: '',
  has_existing_advances: false, existing_advances: [], notes: '', certification_accepted: false, credit_authorization_accepted: false, esign_consent_accepted: false, sms_consent_accepted: false, terms_accepted: false, privacy_policy_accepted: false, authorization_consent: false, sms_consent: false, signature: '', signature_date: new Date().toISOString().slice(0, 10), bot_field: '',
};

const steps = [
  'Business Information',
  'Bank Reference',
  'Owner / Principal Information',
  'Funding Request',
  'Existing Financing',
  'Document Uploads',
  'Authorization & Review',
  'Confirmation',
];

const usStates = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const documentConfig: Array<{ key: DocumentKey; label: string; required: boolean; help: string }> = [
  { key: 'bank_statements', label: 'Last 3 Business Bank Statements', required: true, help: 'Upload all pages of the three most recent business bank statements. PDF preferred; images are accepted when clear and complete.' },
];

function InputField({ label, value, onChange, type = 'text', required = false, placeholder = '', hint = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">{label} {required && <span className="text-[#EF4444]">*</span>}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="input-field w-full" />
      {hint && <p className="text-[12px] text-[#A1A1AA] mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; required?: boolean }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">{label} {required && <span className="text-[#EF4444]">*</span>}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} className="input-field w-full appearance-none bg-white">
        <option value="">Select…</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ checked, onChange, label, help, required = false }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; help?: ReactNode; required?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-[12px] border border-[#E4E4E7] bg-white p-4 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} required={required} className="mt-1 h-4 w-4 rounded border-[#D4D4D8]" />
      <span>
        <span className="block text-[14px] font-medium text-[#09090B]">{label}</span>
        {help && <span className="block text-[12px] text-[#71717A] mt-1 leading-relaxed">{help}</span>}
      </span>
    </label>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return <div><h2 className="text-[22px] font-bold text-[#09090B] mb-1">{title}</h2><p className="text-[14px] text-[#71717A]">{text}</p></div>;
}

function StepBusiness({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="Business Information" text="Provide the legal business profile underwriters use to verify identity, ownership, revenue history, and program fit." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><InputField label="Business Legal Name" value={data.legal_name} onChange={(v) => update('legal_name', v)} required /></div>
        <InputField label="DBA Name" value={data.dba} onChange={(v) => update('dba', v)} />
        <SelectField label="Legal Entity Type" value={data.entity_type} onChange={(v) => update('entity_type', v)} required options={[{ value: 'llc', label: 'LLC' }, { value: 'corporation', label: 'Corporation' }, { value: 'sole_proprietor', label: 'Sole Proprietor' }, { value: 'partnership', label: 'Partnership' }, { value: 'other', label: 'Other' }]} />
        <InputField label="Full Federal Tax ID / EIN" value={data.ein} onChange={(v) => update('ein', v)} required placeholder="12-3456789" />
        <SelectField label="Merchant Type" value={data.merchant_type} onChange={(v) => update('merchant_type', v)} required options={[{ value: 'retail', label: 'Retail' }, { value: 'restaurant', label: 'Restaurant' }, { value: 'service', label: 'Service' }, { value: 'ecommerce', label: 'E-commerce' }, { value: 'other', label: 'Other' }]} />
        <InputField label="Date Business Started" value={data.start_date} onChange={(v) => update('start_date', v)} type="date" required />
        <SelectField label="Business Location" value={data.business_location} onChange={(v) => update('business_location', v)} required options={[{ value: 'leased', label: 'Leased' }, { value: 'owned', label: 'Owned' }, { value: 'home_based', label: 'Home Based' }, { value: 'online', label: 'Online' }]} />
        <InputField label="Business Phone" value={data.business_phone} onChange={(v) => update('business_phone', v)} required />
        <InputField label="Business Mobile Phone" value={data.business_mobile} onChange={(v) => update('business_mobile', v)} />
        <InputField label="Fax" value={data.fax} onChange={(v) => update('fax', v)} />
        <InputField label="Business Email" value={data.business_email} onChange={(v) => update('business_email', v)} type="email" required />
        <InputField label="Website" value={data.website} onChange={(v) => update('website', v)} />
        <div className="md:col-span-2"><InputField label="Address" value={data.address} onChange={(v) => update('address', v)} required /></div>
        <InputField label="City" value={data.city} onChange={(v) => update('city', v)} required />
        <div className="grid grid-cols-2 gap-4"><SelectField label="State" value={data.state} onChange={(v) => update('state', v)} required options={usStates.map((state) => ({ value: state, label: state }))} /><InputField label="Zip" value={data.zip} onChange={(v) => update('zip', v)} required /></div>
        <div className="md:col-span-2"><InputField label="Products / Services Sold" value={data.products_services} onChange={(v) => update('products_services', v)} required /></div>
        <InputField label="POS Company Contact" value={data.pos_contact_name} onChange={(v) => update('pos_contact_name', v)} />
        <InputField label="POS Company Phone" value={data.pos_contact_phone} onChange={(v) => update('pos_contact_phone', v)} />
        <InputField label="Terminal / POS System" value={data.pos_system} onChange={(v) => update('pos_system', v)} />
        <InputField label="Industry" value={data.industry} onChange={(v) => update('industry', v)} required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CheckboxField checked={data.has_judgments} onChange={(v) => update('has_judgments', v)} label="Business has judgments" />
        <CheckboxField checked={data.has_tax_lien} onChange={(v) => update('has_tax_lien', v)} label="Business has tax liens" />
        <CheckboxField checked={data.has_bankruptcy} onChange={(v) => update('has_bankruptcy', v)} label="Business has bankruptcy history" />
        <CheckboxField checked={data.is_seasonal} onChange={(v) => update('is_seasonal', v)} label="Seasonal business" />
      </div>
    </div>
  );
}

function StepBanking({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="References & Banking" text="Provide your current business bank relationship. We do not request routing numbers or full account numbers in this application." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Bank Name" value={data.bank_name} onChange={(v) => update('bank_name', v)} required />
        <InputField label="Bank Contact" value={data.bank_contact} onChange={(v) => update('bank_contact', v)} />
        <InputField label="Bank Phone" value={data.bank_phone} onChange={(v) => update('bank_phone', v)} />
        <SelectField label="Account Type" value={data.account_type} onChange={(v) => update('account_type', v)} options={[{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }]} />
      </div>
    </div>
  );
}

function OwnerCard({ title, owner, required, update }: { title: string; owner: OwnerFields; required?: boolean; update: <K extends keyof OwnerFields>(key: K, value: OwnerFields[K]) => void }) {
  return (
    <div className="rounded-[16px] border border-[#E4E4E7] p-5 space-y-4">
      <h3 className="text-[16px] font-semibold text-[#09090B]">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="First Name" value={owner.first_name} onChange={(v) => update('first_name', v)} required={required} />
        <InputField label="Last Name" value={owner.last_name} onChange={(v) => update('last_name', v)} required={required} />
        <InputField label="Title" value={owner.title} onChange={(v) => update('title', v)} />
        <InputField label="Ownership %" value={owner.ownership_pct} onChange={(v) => update('ownership_pct', v)} type="number" required={required} />
        <InputField label="Email" value={owner.email} onChange={(v) => update('email', v)} type="email" required={required} />
        <InputField label="Owner Phone" value={owner.phone} onChange={(v) => update('phone', v)} required={required} />
        <InputField label="Owner Mobile Phone" value={owner.mobile} onChange={(v) => update('mobile', v)} required={required} />
        <InputField label="Date of Birth" value={owner.dob} onChange={(v) => update('dob', v)} type="date" required={required} />
        <InputField label="Full Social Security Number" value={owner.ssn} onChange={(v) => update('ssn', v)} type="password" required={required} placeholder="XXX-XX-XXXX" hint="Used for authorized underwriting and identity verification; transmitted through the secure application workflow." />
        <SelectField label="Credit Score Range" value={owner.credit_range} onChange={(v) => update('credit_range', v)} options={[{ value: '720+', label: '720+' }, { value: '680-719', label: '680–719' }, { value: '640-679', label: '640–679' }, { value: '600-639', label: '600–639' }, { value: '<600', label: 'Below 600' }]} />
        <div className="md:col-span-2"><InputField label="Home Address" value={owner.address} onChange={(v) => update('address', v)} required={required} /></div>
        <InputField label="City" value={owner.city} onChange={(v) => update('city', v)} required={required} />
        <div className="grid grid-cols-2 gap-4"><SelectField label="State" value={owner.state} onChange={(v) => update('state', v)} required={required} options={usStates.map((state) => ({ value: state, label: state }))} /><InputField label="Zip" value={owner.zip} onChange={(v) => update('zip', v)} required={required} /></div>
      </div>
    </div>
  );
}

function StepOwners({ data, updateOwner }: { data: ApplicationFormData; updateOwner: (ownerKey: OwnerKey, key: keyof OwnerFields, value: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="Owner / Principal Information" text="Owner 1 is required. Full SSN and owner mobile phone are collected for identity, fraud-prevention, and underwriting authorization." />
      <OwnerCard title="Owner / Principal 1" owner={data.owner1} required update={(key, value) => updateOwner('owner1', key, value)} />
      <OwnerCard title="Owner / Principal 2" owner={data.owner2} update={(key, value) => updateOwner('owner2', key, value)} />
    </div>
  );
}

function StepFunding({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="Funding Information" text="Share the requested amount, revenue context, and use of funds so advisors can evaluate appropriate capital structures without overpromising availability." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Amount Requested" value={data.requested_amount} onChange={(v) => update('requested_amount', v)} type="number" required />
        <InputField label="Use of Funds" value={data.use_of_funds} onChange={(v) => update('use_of_funds', v)} required />
        <InputField label="Average Monthly Sales" value={data.average_monthly_sales} onChange={(v) => update('average_monthly_sales', v)} type="number" required />
        <InputField label="Average Visa/MasterCard Monthly Sales" value={data.average_visa_mc_sales} onChange={(v) => update('average_visa_mc_sales', v)} type="number" />
        <InputField label="Monthly Gross Revenue" value={data.monthly_gross_revenue} onChange={(v) => update('monthly_gross_revenue', v)} type="number" required />
        <SelectField label="Desired Funding Timeline" value={data.timeline} onChange={(v) => update('timeline', v)} options={[{ value: 'asap', label: 'As soon as possible' }, { value: '1_week', label: 'Within 1 week' }, { value: '2_4_weeks', label: '2–4 weeks' }, { value: 'exploring', label: 'Exploring options' }]} />
      </div>
      <textarea value={data.notes} onChange={(event) => update('notes', event.target.value)} rows={4} className="w-full bg-white border border-[#E4E4E7] rounded-[10px] px-[14px] py-3 text-[15px] text-[#09090B] placeholder-[#A1A1AA] resize-none focus:outline-none focus:border-[#0F2B5B]" placeholder="Additional context for underwriting…" />
    </div>
  );
}

function StepExistingAdvances({ data, update }: { data: ApplicationFormData; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  const addAdvance = () => update('existing_advances', [...data.existing_advances, { funder_name: '', original_amount: '', current_balance: '', daily_payment: '', payment_frequency: '', notes: '' }]);
  const updateAdvance = (index: number, key: keyof ExistingAdvance, value: string) => update('existing_advances', data.existing_advances.map((advance, i) => i === index ? { ...advance, [key]: value } : advance));
  const removeAdvance = (index: number) => update('existing_advances', data.existing_advances.filter((_, i) => i !== index));

  return (
    <div className="space-y-6">
      <SectionIntro title="Existing Revenue-Based Financing" text="Disclose active or recently satisfied merchant cash advance or revenue-based financing balances so repayment capacity can be reviewed responsibly." />
      <CheckboxField checked={data.has_existing_advances} onChange={(v) => update('has_existing_advances', v)} label="Business has active or recently satisfied revenue-based financing / cash advances" />
      {data.existing_advances.map((advance, index) => (
        <div key={index} className="rounded-[16px] border border-[#E4E4E7] p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Advance {index + 1}</h3><button type="button" onClick={() => removeAdvance(index)} className="text-[#EF4444]"><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Funder Name" value={advance.funder_name} onChange={(v) => updateAdvance(index, 'funder_name', v)} />
            <InputField label="Original Amount" value={advance.original_amount} onChange={(v) => updateAdvance(index, 'original_amount', v)} type="number" />
            <InputField label="Current Balance" value={advance.current_balance} onChange={(v) => updateAdvance(index, 'current_balance', v)} type="number" />
            <InputField label="Daily / Regular Payment" value={advance.daily_payment} onChange={(v) => updateAdvance(index, 'daily_payment', v)} type="number" />
            <SelectField label="Payment Frequency" value={advance.payment_frequency} onChange={(v) => updateAdvance(index, 'payment_frequency', v)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'bi_weekly', label: 'Bi-weekly' }]} />
            <InputField label="Notes" value={advance.notes} onChange={(v) => updateAdvance(index, 'notes', v)} />
          </div>
        </div>
      ))}
      <button type="button" onClick={addAdvance} className="btn-secondary">Add Existing Financing</button>
    </div>
  );
}

function StepDocuments({ files, setFiles }: { files: Record<DocumentKey, File[]>; setFiles: (key: DocumentKey, files: File[]) => void }) {
  return (
    <div className="space-y-6">
      <SectionIntro title="Document Uploads" text="Upload the supporting documents required for underwriting. Documents are stored in the private application-documents bucket." />
      {documentConfig.map((doc) => (
        <div key={doc.key} className="rounded-[16px] border border-[#E4E4E7] p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1"><div className="font-semibold text-[#09090B]">{doc.label} {doc.required && <span className="text-[#EF4444]">*</span>}</div><p className="text-[13px] text-[#71717A] mt-1">{doc.help}</p><p className="text-[12px] text-[#A1A1AA] mt-2">{files[doc.key]?.map((file) => file.name).join(', ') || 'No files selected'}</p></div>
          <label className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#DDE3EF] px-4 h-10 text-[14px] font-semibold cursor-pointer hover:bg-[#F8F9FB]"><UploadCloud className="w-4 h-4" />Choose Files<input aria-label={doc.label} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" className="hidden" onChange={(event) => setFiles(doc.key, Array.from(event.target.files || []))} /></label>
        </div>
      ))}
    </div>
  );
}

function StepReview({ data, files, update }: { data: ApplicationFormData; files: Record<DocumentKey, File[]>; update: <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => void }) {
  const uploaded = documentConfig.map((doc) => `${doc.label}: ${files[doc.key].length ? files[doc.key].map((file) => file.name).join(', ') : 'Missing'}`);
  return (
    <div className="space-y-6">
      <SectionIntro title="Authorization & Final Review" text="Review the application and complete the required certification, authorization, e-signature, and consent fields before submission." />
      <div className="rounded-[16px] bg-[#F8F9FB] border border-[#E4E4E7] p-5 space-y-3 text-[14px] text-[#52525B] leading-relaxed">
        <p><strong className="text-[#09090B]">Application certification.</strong> I certify that all information and documents submitted are accurate, true, correct, and complete, including business information, owner/principal information, financial records, uploaded bank statements, and other submitted materials.</p>
        <p><strong className="text-[#09090B]">Credit and background authorization.</strong> I authorize Elite Funding Solutions and its recipients, partners, successors, assigns, agents, affiliates, service providers, lenders, funding partners, banks, processors, credit bureaus, and underwriting partners to obtain consumer, personal, business, investigative, credit, processor, bank statement, bank, and financial reports for underwriting, funding, renewal, servicing, verification, fraud-prevention, and compliance purposes.</p>
        <p><strong className="text-[#09090B]">Sharing authorization.</strong> I authorize Elite Funding Solutions to share application information, owner/principal information, authorization data, bank reference information, financial records, and uploaded bank statements with funding partners and other recipients for underwriting, offer generation, document verification, funding, servicing, renewals, and compliance.</p>
        <p><strong className="text-[#09090B]">E-signature consent.</strong> I consent to use electronic records and electronic signatures. My typed name, checkbox selections, timestamp, IP address, user agent, and consent version may be stored with this submission.</p>
        <p><strong className="text-[#09090B]">SMS/text consent.</strong> By checking the SMS consent box, I consent to receive text messages from Elite Funding Solutions. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of purchase where legally required.</p>
        <p className="text-[12px] text-[#71717A]">Consent version: {CONSENT_VERSION}</p>
      </div>
      <div className="rounded-[14px] border border-[#E4E4E7] p-4 text-[13px] text-[#71717A] space-y-1"><p className="font-semibold text-[#09090B]">Required uploads</p>{uploaded.map((item) => <p key={item}>{item}</p>)}</div>
      <div className="space-y-3">
        <CheckboxField required checked={data.certification_accepted} onChange={(v) => update('certification_accepted', v)} label="I certify that all information and documents submitted are accurate, true, correct, and complete." />
        <CheckboxField required checked={data.credit_authorization_accepted} onChange={(v) => { update('credit_authorization_accepted', v); update('authorization_consent', v); }} label="I authorize Elite Funding Solutions and its funding partners, affiliates, service providers, and recipients to obtain consumer, personal, business, investigative, credit, bank, processor, and financial reports for underwriting and funding purposes." />
        <CheckboxField required checked={data.esign_consent_accepted} onChange={(v) => update('esign_consent_accepted', v)} label="I consent to use electronic records and electronic signatures." />
        <CheckboxField required checked={data.sms_consent_accepted} onChange={(v) => { update('sms_consent_accepted', v); update('sms_consent', v); }} label="By checking this box, I consent to receive text messages from Elite Funding Solutions. Message and data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase." />
        <CheckboxField required checked={data.terms_accepted && data.privacy_policy_accepted} onChange={(v) => { update('terms_accepted', v); update('privacy_policy_accepted', v); }} label={<span>I agree to the <a className="text-[#0F2B5B] underline" href="/privacy-policy" target="_blank">Privacy Policy</a>, <a className="text-[#0F2B5B] underline" href="/terms-of-use" target="_blank">Terms of Use</a>, <a className="text-[#0F2B5B] underline" href="/application-consent" target="_blank">Application Consent</a>, <a className="text-[#0F2B5B] underline" href="/esign-consent" target="_blank">E-Sign Consent</a>, <a className="text-[#0F2B5B] underline" href="/sms-terms" target="_blank">SMS Terms</a>, and <a className="text-[#0F2B5B] underline" href="/disclosures" target="_blank">Compliance Disclosures</a>.</span>} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><InputField label="Signed Name" value={data.signature} onChange={(v) => update('signature', v)} required hint="Type your full legal name." /><InputField label="Signature Date" value={data.signature_date} onChange={(v) => update('signature_date', v)} type="date" required /></div>
      <input type="text" value={data.bot_field} onChange={(event) => update('bot_field', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    </div>
  );
}

function StepConfirmation({ data }: { data: ApplicationFormData }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-8 h-8 text-[#10B981]" /></div>
      <h2 className="text-[26px] font-bold text-[#09090B] mb-3">Application Submitted</h2>
      <p className="text-[16px] text-[#71717A] max-w-[460px] mx-auto leading-relaxed mb-8">Thank you, {data.owner1.first_name || 'there'}. Your secure funding application and bank statements have been received. A funding advisor will review the complete file and contact you with next steps.</p>
      <a href="/" className="btn-gold">Return Home <ArrowRight className="w-4 h-4" /></a>
    </div>
  );
}

export default function ApplyPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [form, setForm] = useState<ApplicationFormData>(initialForm);
  const [files, setFilesState] = useState<Record<DocumentKey, File[]>>({ bank_statements: [] });
  const [submitting, setSubmitting] = useState(false);


  const progressPct = useMemo(() => ((currentStep - 1) / 7) * 100, [currentStep]);
  const updateField = <K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateOwner = (ownerKey: OwnerKey, key: keyof OwnerFields, value: string) => setForm((prev) => ({ ...prev, [ownerKey]: { ...prev[ownerKey], [key]: value } }));
  const setFiles = (key: DocumentKey, selectedFiles: File[]) => setFilesState((prev) => ({ ...prev, [key]: selectedFiles }));
  const next = () => setCurrentStep((step) => Math.min(step + 1, 8) as Step);
  const back = () => setCurrentStep((step) => Math.max(step - 1, 1) as Step);

  const digitsOnly = (value: string) => value.replace(/\D/g, '');
  const invalidUpload = files.bank_statements.find((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return file.size > 10 * 1024 * 1024 || !['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif'].includes(extension);
  });
  const missingRequiredDocs = files.bank_statements.length < 3 ? ['Last 3 Business Bank Statements'] : [];

  const handleSubmit = async () => {
    if (digitsOnly(form.ein).length !== 9) return toast.error('EIN must be exactly 9 digits.');
    if (digitsOnly(form.owner1.ssn).length !== 9) return toast.error('Owner SSN must be exactly 9 digits.');
    if (digitsOnly(form.owner1.mobile).length < 10 || digitsOnly(form.owner1.phone).length < 10 || digitsOnly(form.business_phone).length < 10) return toast.error('Please provide valid phone and mobile numbers.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.business_email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.owner1.email)) return toast.error('Please provide valid business and owner email addresses.');
    const ownership = Number(form.owner1.ownership_pct);
    if (!Number.isFinite(ownership) || ownership < 0 || ownership > 100) return toast.error('Ownership percentage must be between 0 and 100.');
    if (Number(form.requested_amount) <= 0 || Number(form.monthly_gross_revenue) <= 0 || Number(form.average_monthly_sales) <= 0) return toast.error('Revenue and requested funding amounts must be positive.');
    if (invalidUpload) return toast.error('Uploads must be PDF, PNG, JPG, JPEG, or HEIC files up to 10MB each.');
    if (!form.certification_accepted) return toast.error('Please accept the certification of accuracy.');
    if (!form.credit_authorization_accepted || !form.authorization_consent) return toast.error('Please accept the required credit/background authorization.');
    if (!form.esign_consent_accepted) return toast.error('Please accept the e-signature consent.');
    if (!form.sms_consent_accepted) return toast.error('Please accept the SMS consent disclosure.');
    if (!form.terms_accepted || !form.privacy_policy_accepted) return toast.error('Please accept the legal policies and disclosures.');
    if (!form.signature || !form.signature_date) return toast.error('Please complete the e-signature and date fields.');
    if (missingRequiredDocs.length > 0) return toast.error('Please upload all three recent business bank statement files.');

    setSubmitting(true);
    try {
      const body = new globalThis.FormData();
      body.append('payload', JSON.stringify({ ...form, consent_version: CONSENT_VERSION }));
      documentConfig.forEach((doc) => files[doc.key].forEach((file) => body.append(doc.key, file)));

      const response = await fetch('/api/applications/submit', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Application submission failed.');

      setCurrentStep(8);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] pt-8 pb-20">
      <div className="max-w-[860px] mx-auto px-6">
        <div className="text-center mb-10"><h1 className="text-[28px] font-bold text-[#0A1628] tracking-tight mb-2">Secure Elite Funding Solutions Application</h1><p className="text-[15px] text-[#5A6A85]">Complete one encrypted funding request. We ask for full EIN, full SSN, owner mobile phone, and the last three business bank statements; we do not ask for routing numbers, full account numbers, rent/landlord details, average daily balance, or NSF count.</p></div>
        {currentStep < 8 && <div className="mb-8"><div className="flex items-center justify-between mb-2"><span className="text-[13px] font-medium text-[#52525B]">Step {currentStep} of 7: {steps[currentStep - 1]}</span><span className="text-[13px] text-[#A1A1AA]">{Math.round(progressPct)}% complete</span></div><div className="h-1.5 bg-[#E4E4E7] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-300" style={{ background: 'linear-gradient(90deg, #0F2B5B, #C9A84C)', width: `${progressPct}%` }} /></div></div>}
        <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-6 md:p-8" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          {currentStep === 1 && <StepBusiness data={form} update={updateField} />}
          {currentStep === 2 && <StepBanking data={form} update={updateField} />}
          {currentStep === 3 && <StepOwners data={form} updateOwner={updateOwner} />}
          {currentStep === 4 && <StepFunding data={form} update={updateField} />}
          {currentStep === 5 && <StepExistingAdvances data={form} update={updateField} />}
          {currentStep === 6 && <StepDocuments files={files} setFiles={setFiles} />}
          {currentStep === 7 && <StepReview data={form} files={files} update={updateField} />}
          {currentStep === 8 && <StepConfirmation data={form} />}
          {currentStep < 8 && <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#F4F4F5]"><button type="button" onClick={back} disabled={currentStep === 1} className="inline-flex items-center gap-2 text-[14px] font-medium px-4 py-2 rounded-[8px] transition-colors disabled:text-[#A1A1AA] disabled:cursor-not-allowed text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F5]"><ArrowLeft className="w-4 h-4" />Back</button><div className="hidden sm:flex items-center gap-2">{steps.slice(0, 7).map((_, i) => <div key={i} className={`rounded-full transition-all ${i + 1 === currentStep ? 'w-6 h-2 bg-[#0F2B5B]' : i + 1 < currentStep ? 'w-2 h-2 bg-[#10B981]' : 'w-2 h-2 bg-[#E4E4E7]'}`} />)}</div>{currentStep === 7 ? <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 rounded-[10px] bg-[#10B981] text-white font-semibold text-[14px] h-10 px-5 transition-all hover:bg-[#059669] disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Application'} {!submitting && <CheckCircle2 className="w-4 h-4" />}</button> : <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-[10px] bg-[#0F2B5B] text-white font-semibold text-[14px] h-10 px-5 transition-all hover:bg-[#0A1E42]">Continue <ArrowRight className="w-4 h-4" /></button>}</div>}
        </div>
        {currentStep < 8 && <div className="mt-6 flex items-center justify-center gap-6 text-[12px] text-[#8C9BB5]"><span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Secure</span><span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />Encrypted uploads</span><span>Server-side secure submission</span></div>}
      </div>
    </div>
  );
}
