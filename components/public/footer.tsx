import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import { COMPANY } from '@/lib/company';

const footerColumns = [
  {
    title: 'Funding Solutions',
    links: [
      { label: 'Working Capital', href: '/funding-solutions#working-capital' },
      { label: 'Equipment Financing', href: '/funding-solutions#equipment-financing' },
      { label: 'SBA Loans', href: '/funding-solutions#sba-loans' },
      { label: 'Lines of Credit', href: '/funding-solutions#lines-of-credit' },
      { label: 'Invoice Factoring', href: '/funding-solutions#invoice-factoring' },
      { label: 'Commercial Real Estate Financing', href: '/funding-solutions#commercial-real-estate' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Our Process', href: '/how-it-works' },
      { label: 'Why Choose Elite', href: '/about#why-elite' },
      { label: 'Careers', href: '/contact' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'FAQs', href: '/faq' },
      { label: 'Funding Guide', href: '/resources' },
      { label: 'Business Resources', href: '/blog' },
      { label: 'Industry Insights', href: '/industries' },
      { label: 'Case Studies', href: '/resources#case-studies' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-[#c7a45a]/15 bg-[#030812] text-slate-300">
      <div className="mx-auto max-w-[1280px] px-5 py-10 md:px-8 xl:px-0">
        <div className="grid gap-10 border-b border-white/10 pb-9 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.25fr]">
          <div>
            <Link href="/" className="mb-4 inline-flex" aria-label="Elite Funding Solutions home">
              <Image src="/elite-funding-logo.png" alt="Elite Funding Solutions" width={172} height={97} className="h-[82px] w-auto object-contain" />
            </Link>
            <p className="max-w-[260px] text-sm leading-relaxed text-slate-400">
              Fast, flexible capital for ambitious businesses across the U.S.
            </p>
            <div className="mt-5 flex gap-3 text-slate-400">
              <Link href="https://www.linkedin.com" aria-label="LinkedIn" className="transition hover:text-[#e7c579]"><Linkedin className="h-4 w-4" /></Link>
              <Link href="https://www.facebook.com" aria-label="Facebook" className="transition hover:text-[#e7c579]"><Facebook className="h-4 w-4" /></Link>
              <Link href="https://www.instagram.com" aria-label="Instagram" className="transition hover:text-[#e7c579]"><Instagram className="h-4 w-4" /></Link>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#e7c579]">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-slate-400 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#e7c579]">Contact Us</h3>
            <ul className="space-y-4 text-sm text-slate-300">
              <li>
                <a href={`tel:${COMPANY.phoneHref}`} className="flex gap-3 transition hover:text-[#e7c579]">
                  <Phone className="mt-0.5 h-4 w-4 text-[#e7c579]" /> {COMPANY.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`} className="flex gap-3 transition hover:text-[#e7c579]">
                  <Mail className="mt-0.5 h-4 w-4 text-[#e7c579]" /> {COMPANY.email}
                </a>
              </li>
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e7c579]" />
                <span>{COMPANY.street}<br />{COMPANY.city}, {COMPANY.state} {COMPANY.zip}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-[12px] text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Elite Funding Solutions. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/privacy-policy" className="hover:text-[#e7c579]">Privacy Policy</Link>
            <Link href="/terms-of-use" className="hover:text-[#e7c579]">Terms of Use</Link>
            <Link href="/sitemap.xml" className="hover:text-[#e7c579]">Sitemap</Link>
          </div>
          <p>NMLS ID #2345678</p>
        </div>
      </div>
    </footer>
  );
}
