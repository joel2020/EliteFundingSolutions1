import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Studies | Elite Funding Solutions',
  description: 'Anonymized business funding scenarios showing how documentation, cash flow, and product fit influence funding conversations.',
  alternates: { canonical: '/case-studies' },
};

const cases = [
  ['Restaurant inventory bridge', 'A multi-location restaurant needed capital ahead of a seasonal demand spike. The file emphasized deposit consistency, card processing volume, and repayment sensitivity around slower weekdays.', 'Revenue-based funding and working-capital offers were compared with clear holdback/payment context before the operator selected a fit.'],
  ['Contractor mobilization costs', 'A construction business needed materials and payroll support before receivables were collected. Underwriting reviewed bank statements, project timing, and existing obligations.', 'The advisor focused the request on use of funds, expected receivable timing, and whether a short-term structure could bridge the gap responsibly.'],
  ['Medical equipment upgrade', 'A healthcare practice wanted to preserve cash while adding revenue-producing equipment. The package included equipment quote details, business revenue history, and owner information.', 'Equipment financing was evaluated against working-capital alternatives so the borrower could compare term length and cash-flow impact.'],
];

export default function CaseStudiesPage() {
  return <main className="bg-[#030812] text-white"><section className="container-page py-20 md:py-28"><p className="eyebrow mb-4">Case studies</p><h1 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">Funding scenarios with practical takeaways.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">These anonymized examples show how documentation, cash flow, and product fit shape the funding conversation.</p></section><section className="container-page grid gap-5 pb-16 lg:grid-cols-3">{cases.map(([title, context, outcome]) => <article key={title} className="premium-card flex flex-col p-7"><h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2><p className="mt-4 leading-7 text-slate-300">{context}</p><div className="mt-6 rounded-sm border border-[#d6af62]/14 bg-[#030812] p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d6af62]">Advisor focus</p><p className="mt-2 text-sm leading-6 text-slate-300">{outcome}</p></div></article>)}</section><section className="container-page pb-20"><div className="rounded-sm border border-[#d6af62]/18 bg-[#061326] p-8 text-white md:p-10"><h2 className="text-3xl font-semibold tracking-tight text-white">Compare your own scenario securely.</h2><p className="mt-3 max-w-2xl leading-7 text-slate-300">Funding decisions vary by profile, revenue, risk, partner criteria, documentation, and final agreements.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/funding-fit-check" className="btn-gold">Request fit check</Link><Link href="/apply" className="btn-dark-outline">Full application</Link></div></div></section></main>;
}
