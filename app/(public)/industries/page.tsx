import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Industries Served | Elite Funding Solutions',
  description: 'Business funding for construction, healthcare, restaurants, trucking, retail, professional services, and more.',
};

const industries = ['Construction', 'Healthcare', 'Restaurants', 'Trucking & Logistics', 'Retail', 'Professional Services', 'Manufacturing', 'Automotive', 'E-commerce', 'Commercial Real Estate'];

export default function IndustriesPage() {
  return (
    <section className="section bg-[#040B16] text-white min-h-screen">
      <div className="container-page">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C] mb-4">Industries We Serve</p>
        <h1 className="text-[44px] md:text-[60px] font-bold tracking-tight max-w-3xl mb-5">Industry-specific funding for operators who move fast.</h1>
        <p className="text-[#8C9BB5] text-[18px] leading-relaxed max-w-3xl mb-12">We evaluate business performance, seasonality, cash-flow patterns, and use of funds to help match companies with the right capital structure.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {industries.map((industry) => (
            <div key={industry} className="rounded-[16px] border border-[#1A2B4A] bg-[#07111f] p-6">
              <div className="text-[#C9A84C] text-[13px] uppercase tracking-[0.14em] mb-2">Funding ready</div>
              <h2 className="text-[22px] font-semibold">{industry}</h2>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
