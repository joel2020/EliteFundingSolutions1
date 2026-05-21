import Link from 'next/link';
import { COMPANY, LEGAL_EFFECTIVE_DATE } from '@/lib/company';

export type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <section className="section bg-[#F8FAFC]">
      <div className="container-page max-w-4xl">
        <div className="rounded-[24px] border border-[#CBD5E1] bg-white p-6 shadow-sm md:p-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8A6A22]">Legal Compliance</p>
          <h1 className="text-[34px] md:text-[44px] font-bold tracking-tight text-[#0A1628] mb-4">{title}</h1>
          <p className="mb-6 text-[16px] font-normal leading-[1.65] text-[#111827]">{intro}</p>
          <div className="mb-8 grid grid-cols-1 gap-3 rounded-[16px] border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[14px] font-normal leading-[1.55] text-[#111827] md:grid-cols-2">
            <div><strong>Effective date:</strong> {LEGAL_EFFECTIVE_DATE}</div>
            <div><strong>Last updated:</strong> {LEGAL_EFFECTIVE_DATE}</div>
            <div className="md:col-span-2"><strong>Contact:</strong> <a className="font-medium text-[#0F2B5B] underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> | {COMPANY.phone}</div>
            <div className="md:col-span-2"><strong>Mailing address:</strong> {COMPANY.mailingAddress}</div>
          </div>
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-[22px] font-semibold text-[#0A1628] mb-3">{section.title}</h2>
                <div className="space-y-3 text-[16px] font-normal leading-[1.65] text-[#111827]">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 border-t border-[#CBD5E1] pt-6 text-[14px] font-normal leading-[1.6] text-[#111827]">
            Questions? Contact {COMPANY.name} at <a className="font-medium text-[#0F2B5B] underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or write to {COMPANY.street}, {COMPANY.city}, {COMPANY.state} {COMPANY.zip}. Return to the <Link className="font-medium text-[#0F2B5B] underline" href="/apply">secure application</Link>.
          </div>
        </div>
      </div>
    </section>
  );
}
