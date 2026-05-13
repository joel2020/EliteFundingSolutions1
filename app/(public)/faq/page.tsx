import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ | Elite Funding Solutions',
  description: 'Answers about business funding eligibility, documents, timelines, credit review, costs, and the secure Elite Funding Solutions application process.',
  alternates: { canonical: '/faq' },
};

const faqs = [
  {
    category: 'Funding options',
    questions: [
      { q: 'What is a merchant cash advance?', a: 'A merchant cash advance is a revenue-based funding structure where a funding company purchases a portion of your future receivables. It can be useful for short-term working capital needs, but repayment frequency, total payback, and cash-flow impact should be reviewed carefully before accepting an offer.' },
      { q: 'What funding products does Elite Funding Solutions support?', a: 'We help businesses evaluate working capital, revenue-based financing, merchant cash advances, business lines of credit, equipment financing, invoice factoring, SBA options, and commercial real estate financing. Product availability depends on underwriting, revenue, business history, collateral, and partner requirements.' },
      { q: 'How much funding can a business request?', a: 'Program ranges typically start around $10,000 and may extend to $5,000,000 or more for qualified requests. Actual availability is based on deposits, revenue consistency, time in business, credit profile, industry, existing obligations, and the requested product.' },
      { q: 'Is approval guaranteed?', a: 'No. We do not guarantee approval, terms, rates, or funding speed. All offers are subject to underwriting, documentation, verification, partner criteria, and final agreement execution.' },
    ],
  },
  {
    category: 'Application process',
    questions: [
      { q: 'What documents should I prepare?', a: 'Most applications begin with business and owner information, full EIN, owner identity details, full SSN authorization, owner mobile phone, and the last 3 business bank statements. Product-specific requests may require tax returns, equipment quotes, invoices, A/R aging, financial statements, or property documents.' },
      { q: 'How should I upload bank statements?', a: 'Upload one combined PDF with the last 3 business bank statements, or upload each statement separately. Include all pages and make sure the business name and statement dates are visible.' },
      { q: 'How fast can the file be reviewed?', a: 'Some working-capital requests can be reviewed within 24–72 hours after a complete file is received. SBA, equipment, receivables, and commercial real estate requests usually require more documentation and longer underwriting timelines.' },
    ],
  },
  {
    category: 'Credit, cost, and repayment',
    questions: [
      { q: 'Does applying affect my credit?', a: 'Credit review depends on the program and authorization provided. Some partners may begin with soft-pull review while others may require additional consumer or business credit reports before final approval or closing.' },
      { q: 'How are repayment terms structured?', a: 'Repayment varies by product. Lines of credit, term loans, equipment financing, factoring, and revenue-based structures all work differently. Your advisor will help compare payment frequency, total cost, term, collateral, and cash-flow fit.' },
      { q: 'Can existing advances or loans be considered?', a: 'Yes, but they must be disclosed. Underwriters review existing balances and payment burden to determine responsible capacity and whether a new structure is appropriate.' },
    ],
  },
];

export default function FAQPage() {
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.flatMap((section) => section.questions.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } }))) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="section bg-[#F8F9FB]">
        <div className="container-page">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="eyebrow mb-3">FAQ</p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#0A1628] md:text-6xl">Straight answers about business funding.</h1>
            <p className="mt-5 text-lg leading-8 text-[#5A6A85]">Understand eligibility, documents, timelines, and repayment mechanics before submitting a secure application.</p>
          </div>

          <div className="mx-auto max-w-4xl space-y-10">
            {faqs.map((section) => (
              <section key={section.category}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#8A6A22]">{section.category}</h2>
                <div className="space-y-3">
                  {section.questions.map((faq) => (
                    <details key={faq.q} className="group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 font-semibold text-[#0A1628] transition hover:bg-[#F8F9FB]">
                        {faq.q}<ChevronDown className="h-5 w-5 shrink-0 text-[#8A6A22] transition group-open:rotate-180" />
                      </summary>
                      <p className="border-t border-[#E5E7EB] px-6 pb-6 pt-4 leading-8 text-[#5A6A85]">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mx-auto mt-14 max-w-3xl rounded-[28px] bg-[#061326] p-8 text-center text-white md:p-10">
            <h2 className="text-3xl font-semibold tracking-tight">Need help choosing a path?</h2>
            <p className="mt-3 text-slate-300">Talk with an advisor or submit one secure application for review.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="btn-dark-outline">Contact us</Link>
              <Link href="/apply" className="btn-gold">Start application</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
