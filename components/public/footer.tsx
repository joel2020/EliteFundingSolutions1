import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import { COMPANY } from '@/lib/company';

const footerColumns = [
  {
    title: 'Funding',
    links: [
      { label: 'Working Capital', href: '/funding-solutions/working-capital' },
      { label: 'Equipment Financing', href: '/funding-solutions/equipment-financing' },
      { label: 'SBA Loans', href: '/funding-solutions/sba-loans' },
      { label: 'Lines of Credit', href: '/funding-solutions/business-lines-of-credit' },
      { label: 'Invoice Factoring', href: '/funding-solutions/invoice-factoring' },
      { label: 'Commercial Real Estate', href: '/funding-solutions/commercial-real-estate' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Why Choose Elite', href: '/why-choose-elite' },
      { label: 'Industries', href: '/industries' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Funding Guide', href: '/funding-guide' },
      { label: 'Business Resources', href: '/business-resources' },
      { label: 'Case Studies', href: '/case-studies' },
      { label: 'Sitemap', href: '/sitemap' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Use', href: '/terms-of-use' },
      { label: 'Application Consent', href: '/application-consent' },
      { label: 'E-Sign Consent', href: '/esign-consent' },
      { label: 'SMS Terms', href: '/sms-terms' },
      { label: 'Disclosures', href: '/disclosures' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#061326] text-slate-300">
      <div className="container-page py-14">
        <div className="grid gap-10 border-b border-white/10 pb-10 lg:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr_0.9fr]">
          <div>
            <Link href="/" className="mb-5 inline-flex" aria-label="Elite Funding Solutions home">
              <Image src="/elite-funding-logo.png" alt="Elite Funding Solutions" width={180} height={101} className="h-[78px] w-auto object-contain" />
            </Link>
            <p className="max-w-[320px] text-sm leading-7 text-slate-400">
              Secure business funding intake and advisor-led offer comparison for established U.S. operators. Commercial funding marketplace; not a bank.
            </p>
            <div className="mt-6 flex gap-3 text-slate-400">
              <Link href="https://www.linkedin.com" aria-label="LinkedIn" className="rounded-full border border-white/10 p-2 transition hover:border-[#C9A84C]/60 hover:text-[#C9A84C]"><Linkedin className="h-4 w-4" /></Link>
              <Link href="https://www.facebook.com" aria-label="Facebook" className="rounded-full border border-white/10 p-2 transition hover:border-[#C9A84C]/60 hover:text-[#C9A84C]"><Facebook className="h-4 w-4" /></Link>
              <Link href="https://www.instagram.com" aria-label="Instagram" className="rounded-full border border-white/10 p-2 transition hover:border-[#C9A84C]/60 hover:text-[#C9A84C]"><Instagram className="h-4 w-4" /></Link>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#C9A84C]">{column.title}</h3>
              <ul className="space-y-3">
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
        </div>

        <div className="grid gap-8 border-b border-white/10 py-8 lg:grid-cols-[1fr_1fr_1fr]">
          <a href={`tel:${COMPANY.phoneHref}`} className="flex gap-3 text-sm transition hover:text-[#C9A84C]"><Phone className="mt-0.5 h-4 w-4 text-[#C9A84C]" /> {COMPANY.phone}</a>
          <a href={`mailto:${COMPANY.email}`} className="flex gap-3 text-sm transition hover:text-[#C9A84C]"><Mail className="mt-0.5 h-4 w-4 text-[#C9A84C]" /> {COMPANY.email}</a>
          <div className="flex gap-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" /><span>{COMPANY.street}, {COMPANY.city}, {COMPANY.state} {COMPANY.zip}</span></div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Elite Funding Solutions. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="https://elitefundingsolution.com" className="hover:text-[#C9A84C]">elitefundingsolution.com</Link>
            <Link href="https://crm.elitefundingsolution.com/login" className="hover:text-[#C9A84C]">CRM Login</Link>
            <Link href="/sitemap" className="hover:text-[#C9A84C]">Sitemap</Link>
          </div>
          <p>Terms are subject to underwriting and partner approval.</p>
        </div>
      </div>
    </footer>
  );
}
