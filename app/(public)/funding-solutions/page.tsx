import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Building2, CreditCard, Landmark, Receipt, Truck, WalletCards } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Funding Solutions | Elite Funding Solutions',
  description: 'Explore merchant cash advances, working capital, equipment financing, SBA loans, lines of credit, invoice factoring, and commercial real estate financing.',
};

const solutions = [
  { id: 'mca', icon: WalletCards, title: 'Merchant Cash Advances', text: 'Revenue-based capital structured around business performance, daily sales, and speed-to-funding needs.' },
  { id: 'wcl', icon: CreditCard, title: 'Working Capital', text: 'Flexible operating capital for payroll, inventory, marketing, hiring, remodels, and expansion.' },
  { id: 'equipment', icon: Truck, title: 'Equipment Financing', text: 'Acquire mission-critical equipment while preserving cash flow and matching payments to asset value.' },
  { id: 'sba', icon: Landmark, title: 'SBA Loans', text: 'Government-backed loan options for qualified businesses seeking lower rates and longer amortization.' },
  { id: 'line', icon: Building2, title: 'Business Lines of Credit', text: 'Revolving credit for recurring purchasing power, seasonality, and working capital flexibility.' },
  { id: 'invoice', icon: Receipt, title: 'Invoice Factoring', text: 'Unlock cash tied up in receivables and convert outstanding invoices into operating capital.' },
];

export default function FundingSolutionsPage() {
  return (
    <div className="bg-[#040B16] text-white">
      <section className="container-page py-20">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C] mb-4">Funding Solutions</p>
        <div className="max-w-3xl">
          <h1 className="text-[44px] md:text-[64px] leading-tight font-bold tracking-tight mb-5">Capital products built around your growth plan.</h1>
          <p className="text-[18px] leading-relaxed text-[#8C9BB5]">Elite Funding Solutions structures fast, flexible funding across an institutional network of lending partners so founders can compare options without slowing down operations.</p>
        </div>
      </section>
      <section className="container-page pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {solutions.map(({ id, icon: Icon, title, text }) => (
          <article id={id} key={id} className="rounded-[18px] border border-[#1A2B4A] bg-[#07111f] p-7">
            <Icon className="w-9 h-9 text-[#C9A84C] mb-5" />
            <h2 className="text-[22px] font-semibold mb-3">{title}</h2>
            <p className="text-[15px] leading-relaxed text-[#8C9BB5] mb-6">{text}</p>
            <Link href="/apply" className="inline-flex items-center gap-2 text-[#C9A84C] font-semibold text-[14px]">Get pre-qualified <ArrowRight className="w-4 h-4" /></Link>
          </article>
        ))}
      </section>
    </div>
  );
}
