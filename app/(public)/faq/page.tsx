import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Business Funding FAQ | Elite Funding Solutions', description: 'Answers to common questions about business funding, merchant cash advances, working capital eligibility, application documents, and repayment.', alternates: { canonical: '/faq' } };

const faqs = [
  {
    category: 'About Merchant Cash Advances',
    questions: [
      { q: 'What is a merchant cash advance?', a: 'A merchant cash advance (MCA) is a financing arrangement where a funding company purchases a portion of your future receivables at a discounted rate. Unlike a traditional loan, there are no fixed monthly payments — you repay as a percentage of your daily revenue.' },
      { q: 'Is an MCA a loan?', a: 'No. An MCA is legally structured as a sale of future receivables, not a loan. This means it\'s not subject to state usury laws that govern interest rates on loans. The cost is expressed as a "factor rate," not an interest rate.' },
      { q: 'How is the cost calculated?', a: 'MCA cost is expressed as a factor rate, typically between 1.10 and 1.50. If you receive $50,000 with a 1.35 factor rate, you repay $67,500. The factor rate depends on your revenue, time in business, credit profile, and industry.' },
    ],
  },
  {
    category: 'Eligibility and Qualification',
    questions: [
      { q: 'What are the minimum qualifications?', a: 'Most approvals require: 6+ months in business, $10,000+ in monthly revenue, a 500+ personal credit score, and a valid business bank account. We fund most industries, with some restrictions for high-risk sectors.' },
      { q: 'Can I qualify with bad credit?', a: 'Yes. Credit is one factor, but not the primary one. We focus heavily on your business\'s revenue performance and banking activity. Businesses with credit scores as low as 500 can and do get approved.' },
      { q: 'Can a new business qualify?', a: 'Businesses with 6+ months of operating history and a track record of consistent deposits are generally eligible. Businesses under 6 months old typically do not qualify for our standard products.' },
      { q: 'What industries do you fund?', a: 'We fund most industries including restaurants, retail, healthcare, construction, transportation, automotive, professional services, and more. We have restrictions on adult entertainment, gambling, cannabis, and a few other high-risk sectors.' },
    ],
  },
  {
    category: 'The Application Process',
    questions: [
      { q: 'What documents do I need?', a: 'For most approvals, you only need: your last 3 months of complete bank statements (all pages), a voided business check, and a copy of your government-issued ID. Larger amounts or certain industries may require additional documentation.' },
      { q: 'Does applying hurt my credit score?', a: 'No. We perform a soft credit pull during the application review, which does not impact your credit score. A hard pull is only conducted if and when you formally accept a funded offer.' },
      { q: 'How long does the process take?', a: 'Most applicants receive a funding decision within 4 business hours of submitting a complete application. Funding is wired to your account within 1–3 business days of contract signing. Many clients receive same-day funding.' },
      { q: 'Can I have more than one advance?', a: 'We can work with stacking situations depending on your current balance and revenue levels. Any existing advances must be disclosed on your application. Our underwriting team will review your total payment burden and structure an offer accordingly.' },
    ],
  },
  {
    category: 'Repayment',
    questions: [
      { q: 'How does repayment work?', a: 'Repayment is typically made through a fixed daily or weekly ACH debit from your business checking account. The amount is set when you sign your contract and does not fluctuate based on your actual revenue (unlike true revenue-based financing).' },
      { q: 'What if my business has a slow period?', a: 'Standard MCA repayments are fixed and will continue during slow periods. Some of our funding partners offer modified holdback structures tied to credit card processing volume, which do flex with your sales. Ask your advisor about this option.' },
      { q: 'Can I pay off early?', a: 'Yes. Most of our funding partners allow early payoff. Some will offer a discount on the remaining balance for early settlement. Ask your advisor to confirm the prepayment terms for any offer you receive.' },
    ],
  },
];

export default function FAQPage() {
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.flatMap((section) => section.questions.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } }))) };
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <div className="section">
      <div className="container-page">
        <div className="text-center mb-14">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">FAQs</p>
          <h1 className="text-[40px] font-bold text-[#09090B] tracking-tight mb-4">Frequently Asked Questions</h1>
          <p className="text-[17px] text-[#71717A] max-w-[480px] mx-auto">
            Everything you need to know about our funding process. Can&apos;t find your answer?{' '}
            <Link href="/contact" className="text-[#2563EB] hover:underline">Contact us.</Link>
          </p>
        </div>

        <div className="max-w-[760px] mx-auto space-y-10">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#2563EB] mb-4">
                {section.category}
              </h2>
              <div className="space-y-2">
                {section.questions.map((faq) => (
                  <details
                    key={faq.q}
                    className="group border border-[#E4E4E7] rounded-[12px] bg-white overflow-hidden"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  >
                    <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-[#FAFAFA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] transition-colors" aria-controls={faq.q.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-answer'}>
                      <span className="text-[15px] font-medium text-[#09090B] pr-4">{faq.q}</span>
                      <ChevronDown className="w-4 h-4 text-[#71717A] shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div id={faq.q.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-answer'} className="px-5 pb-5">
                      <p className="text-[14px] text-[#71717A] leading-relaxed">{faq.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center bg-[#FAFAFA] border border-[#E4E4E7] rounded-[20px] p-10 max-w-[600px] mx-auto">
          <h2 className="text-[22px] font-bold text-[#09090B] mb-3">Still have questions?</h2>
          <p className="text-[15px] text-[#71717A] mb-6">Our advisors are available Mon – Fri, 8am – 8pm ET.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact" className="btn-primary">Contact Us</Link>
            <Link href="/apply" className="btn-secondary">Apply Now</Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
