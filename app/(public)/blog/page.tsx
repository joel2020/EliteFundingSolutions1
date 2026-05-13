import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Funding Blog | Elite Funding Solutions',
  description: 'Business funding insights, underwriting preparation tips, and capital strategy articles from Elite Funding Solutions.',
};

const posts = [
  'How to prepare for a working capital application',
  'Merchant cash advance vs. business line of credit',
  'Documents lenders review before issuing an offer',
];

export default function BlogPage() {
  return (
    <section className="section">
      <div className="container-page">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#B8962E] mb-4">Blog</p>
        <h1 className="text-[44px] font-bold tracking-tight mb-8">Business funding insights.</h1>
        <div className="grid gap-4">
          {posts.map((post) => (
            <article key={post} className="rounded-[16px] border border-[#E4E4E7] p-6">
              <h2 className="text-[22px] font-semibold mb-2">{post}</h2>
              <p className="text-[#71717A]">Practical guidance from the Elite Funding Solutions advisory team.</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
