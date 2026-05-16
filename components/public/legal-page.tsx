import Link from 'next/link';
import { COMPANY, LEGAL_EFFECTIVE_DATE } from '@/lib/company';

export type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <section className="section bg-[#030812]">
      <div className="container-page max-w-4xl">
        <div className="rounded-[24px] border border-[#E4E4E7] bg-[#05101d] p-6 md:p-10 shadow-sm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C] mb-3">Legal Compliance</p>
          <h1 className="text-[34px] md:text-[44px] font-bold tracking-tight text-[#0A1628] mb-4">{title}</h1>
          <p className="text-[#5A6A85] leading-relaxed mb-6">{intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-[16px] bg-[#030812] border border-[#E4E4E7] p-4 mb-8 text-[14px] text-[#52525B]">
            <div><strong>Effective date:</strong> {LEGAL_EFFECTIVE_DATE}</div>
            <div><strong>Last updated:</strong> {LEGAL_EFFECTIVE_DATE}</div>
            <div className="md:col-span-2"><strong>Contact:</strong> <a className="text-[#e7c579] underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> | {COMPANY.phone}</div>
            <div className="md:col-span-2"><strong>Mailing address:</strong> {COMPANY.mailingAddress}</div>
          </div>
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-[22px] font-semibold text-[#0A1628] mb-3">{section.title}</h2>
                <div className="space-y-3 text-[15px] leading-7 text-[#3F4A5F]">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 pt-6 border-t border-[#E4E4E7] text-[14px] text-[#5A6A85]">
            Questions? Contact {COMPANY.name} at <a className="text-[#e7c579] underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or write to {COMPANY.street}, {COMPANY.city}, {COMPANY.state} {COMPANY.zip}. Return to the <Link className="text-[#e7c579] underline" href="/apply">secure application</Link>.
          </div>
        </div>
      </div>
    </section>
  );
}
