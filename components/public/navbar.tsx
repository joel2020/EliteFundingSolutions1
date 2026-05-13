'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';

const navLinks = [
  {
    label: 'Funding',
    href: '/funding-solutions',
    children: [
      { label: 'Working Capital', href: '/funding-solutions/working-capital' },
      { label: 'Equipment Financing', href: '/funding-solutions/equipment-financing' },
      { label: 'SBA Loans', href: '/funding-solutions/sba-loans' },
      { label: 'Lines of Credit', href: '/funding-solutions/business-lines-of-credit' },
      { label: 'Invoice Factoring', href: '/funding-solutions/invoice-factoring' },
      { label: 'Commercial Real Estate', href: '/funding-solutions/commercial-real-estate' },
      { label: 'Merchant Cash Advance', href: '/funding-solutions/merchant-cash-advance' },
    ],
  },
  { label: 'Industries', href: '/industries' },
  { label: 'Why Elite', href: '/why-choose-elite' },
  { label: 'About', href: '/about' },
  {
    label: 'Resources',
    href: '/resources',
    children: [
      { label: 'Blog', href: '/blog' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Case Studies', href: '/case-studies' },
      { label: 'Funding Guide', href: '/funding-guide' },
      { label: 'Business Resources', href: '/business-resources' },
      { label: 'Industry Insights', href: '/industry-insights' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  { label: 'Contact', href: '/contact' },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${scrolled ? 'border-[#E5E7EB] bg-white/95 shadow-sm backdrop-blur-xl' : 'border-white/10 bg-[#061326]/92 backdrop-blur-xl'}`}>
      <div className="container-page flex h-18 items-center justify-between py-3 md:h-20">
        <Link href="/" className="flex items-center" aria-label="Elite Funding Solutions home">
          <Image src="/elite-funding-logo.png" alt="Elite Funding Solutions" width={154} height={86} priority className="h-[58px] w-auto object-contain md:h-[66px]" />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="relative" onMouseEnter={() => setOpenDropdown(link.label)} onMouseLeave={() => setOpenDropdown(null)}>
                <button type="button" onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)} className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition ${scrolled ? 'text-[#0A1628] hover:bg-[#F8F9FB]' : 'text-white/88 hover:bg-white/10 hover:text-white'}`} aria-expanded={openDropdown === link.label}>
                  {link.label}
                  <ChevronDown className={`h-4 w-4 transition ${openDropdown === link.label ? 'rotate-180 text-[#C9A84C]' : ''}`} />
                </button>
                {openDropdown === link.label && (
                  <div className="absolute left-1/2 top-full w-80 -translate-x-1/2 pt-4">
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_80px_rgba(10,22,40,0.18)]">
                      <Link href={link.href} className="mb-1 block rounded-xl bg-[#F8F9FB] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A22]">
                        View all {link.label}
                      </Link>
                      {link.children.map((child) => (
                        <Link key={child.label} href={child.href} className="block rounded-xl px-4 py-3 text-sm font-medium text-[#0A1628] transition hover:bg-[#F8F9FB] hover:text-[#8A6A22]">
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link key={link.label} href={link.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${scrolled ? 'text-[#0A1628] hover:bg-[#F8F9FB]' : 'text-white/88 hover:bg-white/10 hover:text-white'}`}>
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link href="https://crm.elitefundingsolution.com/login" className={`text-sm font-semibold transition ${scrolled ? 'text-[#5A6A85] hover:text-[#0A1628]' : 'text-white/70 hover:text-white'}`}>CRM Login</Link>
          <Link href="/apply" className="btn-gold h-11 px-5 text-sm">Get Pre-Qualified</Link>
        </div>

        <button type="button" className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border xl:hidden ${scrolled ? 'border-[#E5E7EB] text-[#0A1628]' : 'border-white/15 text-white'}`} onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle mobile navigation" aria-expanded={menuOpen}>
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-[#E5E7EB] bg-white px-5 py-5 shadow-xl xl:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="border-b border-[#E5E7EB] py-1 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <Link href={link.href} className="flex-1 py-3 text-sm font-semibold text-[#0A1628]" onClick={() => setMenuOpen(false)}>{link.label}</Link>
                  {link.children && <button type="button" className="p-3 text-[#8A6A22]" onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)} aria-label={`Toggle ${link.label} links`} aria-expanded={openDropdown === link.label}><ChevronDown className={`h-4 w-4 transition ${openDropdown === link.label ? 'rotate-180' : ''}`} /></button>}
                </div>
                {link.children && openDropdown === link.label && (
                  <div className="grid gap-1 pb-3 pl-4">
                    {link.children.map((child) => <Link key={child.label} href={child.href} className="py-2 text-sm text-[#5A6A85] hover:text-[#0A1628]" onClick={() => setMenuOpen(false)}>{child.label}</Link>)}
                  </div>
                )}
              </div>
            ))}
            <Link href="/apply" className="btn-gold mt-4 h-12" onClick={() => setMenuOpen(false)}>Get Pre-Qualified</Link>
            <Link href="https://crm.elitefundingsolution.com/login" className="btn-secondary h-12" onClick={() => setMenuOpen(false)}>CRM Login</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
