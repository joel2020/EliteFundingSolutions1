import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Elite Funding Solutions',
  description: 'Elite Funding Solutions delivers white-glove business funding advisory backed by a nationwide lender network.',
};

export default function AboutPage() {
  return (
    <section className="section bg-[#040B16] text-white min-h-screen">
      <div className="container-page grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C] mb-4">About Elite</p>
          <h1 className="text-[44px] md:text-[60px] leading-tight font-bold tracking-tight mb-6">A premium funding desk for ambitious businesses.</h1>
          <p className="text-[18px] leading-relaxed text-[#8C9BB5]">Elite Funding Solutions combines technology-enabled intake, disciplined underwriting, and high-touch advisory to help businesses secure capital with clarity and speed.</p>
        </div>
        <div className="rounded-[24px] border border-[#1A2B4A] bg-[#07111f] p-8 space-y-6">
          {['White-glove funding guidance', 'Nationwide lender relationships', 'Transparent offer comparisons', 'Secure application and document workflows'].map((item) => (
            <div key={item} className="border-b last:border-b-0 border-[#1A2B4A] pb-5 last:pb-0">
              <h2 className="text-[20px] font-semibold text-[#C9A84C]">{item}</h2>
              <p className="text-[#8C9BB5] mt-2">A dedicated advisor helps coordinate every step from pre-qualification to funding.</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
