import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
export const metadata: Metadata = pageMeta({ title: 'Business Funding Calculator | Elite Funding Solutions', description: 'Estimate business funding options based on your revenue, time in business, and capital needs with Elite Funding Solutions.', path: '/calculator' });
export default function CalculatorPage(){return <section className="section"><div className="container-page"><h1 className="text-[44px] font-bold mb-5">Business Funding Calculator</h1><p className="text-[#71717A] max-w-3xl">Use our application flow to receive a personalized funding estimate based on your actual revenue, time in business, and capital needs.</p></div></section>}
