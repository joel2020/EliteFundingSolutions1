'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Menu, Phone, X } from 'lucide-react';
import { COMPANY } from '@/lib/company';

const navLinks = [
  {
    label: 'Funding Solutions',
    href: '/funding-solutions',
    children: [
      { label: 'Merchant Cash Advance', href: '/funding-solutions/merchant-cash-advance' },
      { label: 'Working Capital', href: '/funding-solutions/working-capital' },
      { label: 'Equipment Financing', href: '/funding-solutions/equipment-financing' },
      { label: 'SBA Loans', href: '/funding-solutions/sba-loans' },
      { label: 'Lines of Credit', href: '/funding-solutions/business-lines-of-credit' },
      { label: 'Invoice Factoring', href: '/funding-solutions/invoice-factoring' },
      { label: 'Commercial Real Estate', href: '/funding-solutions/commercial-real-estate' },
    ],
  },
  { label: 'Industries', href: '/industries' },
  { label: 'About Us', href: '/about' },
  {
    label: 'Resources',
    href: '/resources',
    children: [
      { label: 'Funding Guide', href: '/funding-guide' },
      { label: 'Business Resources', href: '/business-resources' },
      { label: 'Industry Insights', href: '/industry-insights' },
      { label: 'Partner Program', href: '/partners' },
    ],
  },
  { label: 'FAQ', href: '/faq' },
  { label: 'Fit Check', href: '/funding-fit-check' },
  { label: 'Contact', href: '/contact' },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? 'border-[#c7a45a]/20 bg-[#030812]/95 shadow-[0_12px_35px_rgba(0,0,0,0.42)]' : 'border-white/5 bg-[#030812]/72 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 md:h-24 md:px-8 xl:px-0">
        <Link href="/" className="group flex items-center" aria-label="Elite Funding Solutions home">
          <Image
            src="/elite-funding-logo.png"
            alt="Elite Funding Solutions"
            width={198}
            height={112}
            priority
            className="h-[72px] w-auto object-contain md:h-[92px]"
          />
        </Link>

        <nav className="hidden items-center gap-7 xl:flex" aria-label="Primary navigation">
          {navLinks.map((link) =>
            link.children ? (
              <div
                key={link.label}
                className="relative"
                onMouseEnter={() => setOpenDropdown(link.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)}
                  className="flex items-center gap-1.5 py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-200 transition hover:text-[#e7c579]"
                  aria-expanded={openDropdown === link.label}
                >
                  {link.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${openDropdown === link.label ? 'rotate-180 text-[#e7c579]' : ''}`} />
                </button>
                {openDropdown === link.label && (
                  <div className="absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3">
                    <div className="rounded-sm border border-[#c7a45a]/25 bg-[#06101f]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                      <Link
                        href={link.href}
                        className="mb-1 block border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e7c579]"
                      >
                        View All {link.label}
                      </Link>
                      {link.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="block rounded-sm px-4 py-3 text-[13px] text-slate-300 transition hover:bg-[#c7a45a]/10 hover:text-white"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-200 transition hover:text-[#e7c579]"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-5 xl:flex">
          <a href={`tel:${COMPANY.phoneHref}`} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200 transition hover:text-[#e7c579]">
            <Phone className="h-3.5 w-3.5 text-[#e7c579]" />
            {COMPANY.phone}
          </a>
          <Link href="https://crm.elitefundingsolution.com/login" className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200 transition hover:text-[#e7c579]">CRM Login</Link>
          <Link
            href="/funding-fit-check"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-[#d6af62] px-7 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f1d08a] transition hover:bg-[#d6af62] hover:text-[#050912]"
          >
            Funding Fit Check
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[#c7a45a]/30 text-[#e7c579] xl:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Toggle mobile navigation"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-[#c7a45a]/15 bg-[#030812]/98 px-5 py-5 shadow-[0_25px_60px_rgba(0,0,0,0.55)] xl:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="border-b border-white/8 py-1 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={link.href}
                    className="flex-1 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-100"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                  {link.children && (
                    <button
                      type="button"
                      className="p-3 text-[#e7c579]"
                      onClick={() => setOpenDropdown(openDropdown === link.label ? null : link.label)}
                      aria-label={`Toggle ${link.label} links`}
                      aria-expanded={openDropdown === link.label}
                    >
                      <ChevronDown className={`h-4 w-4 transition ${openDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {link.children && openDropdown === link.label && (
                  <div className="grid gap-1 pb-3 pl-4">
                    {link.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="py-2 text-sm text-slate-400 hover:text-[#e7c579]"
                        onClick={() => setMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/funding-fit-check"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-sm bg-gradient-to-r from-[#b8893f] via-[#f2d17e] to-[#b8893f] px-6 text-[12px] font-bold uppercase tracking-[0.15em] text-[#050912]"
              onClick={() => setMenuOpen(false)}
            >
              Funding Fit Check
            </Link>
            <a
              href={`tel:${COMPANY.phoneHref}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-[#d6af62]/35 px-6 text-[12px] font-bold uppercase tracking-[0.15em] text-white"
              onClick={() => setMenuOpen(false)}
            >
              <Phone className="h-4 w-4 text-[#e7c579]" />
              {COMPANY.phone}
            </a>
            <Link
              href="https://crm.elitefundingsolution.com/login"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-[#d6af62]/45 px-6 text-[12px] font-bold uppercase tracking-[0.15em] text-white"
              onClick={() => setMenuOpen(false)}
            >
              CRM Login
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
