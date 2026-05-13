'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown } from 'lucide-react';

const navLinks = [
  {
    label: 'Funding Solutions',
    href: '/funding-solutions',
    children: [
      { label: 'Merchant Cash Advance', href: '/funding-solutions#mca' },
      { label: 'Working Capital Line', href: '/funding-solutions#wcl' },
      { label: 'Equipment Financing', href: '/funding-solutions#equipment' },
      { label: 'Invoice Factoring', href: '/funding-solutions#invoice' },
    ],
  },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Industries', href: '/industries' },
  { label: 'About', href: '/about' },
  { label: 'Resources', href: '/resources' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#070E1A] border-b border-[#1A2B4A]'
          : 'bg-[#070E1A]/95 backdrop-blur-sm border-b border-[#1A2B4A]/50'
      }`}
      style={{ boxShadow: scrolled ? '0 1px 16px rgba(0,0,0,0.3)' : 'none' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-0">
        <div className="flex items-center justify-between h-[68px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="relative w-9 h-9 rounded-[8px] overflow-hidden bg-[#0F1E35] flex items-center justify-center">
              <Image
                src="/elite-funding-logo.png"
                alt="Elite Funding Solutions"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[15px] text-white tracking-tight leading-tight">Elite Funding</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C] leading-tight">Solutions</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.children ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-3 py-2 text-[14px] font-medium text-[#8C9BB5] hover:text-white transition-colors rounded-[8px] hover:bg-[#1A2B4A]">
                    {link.label}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === link.label ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openDropdown === link.label && (
                    <div
                      className="absolute top-full left-0 mt-1 w-60 bg-[#0D1E35] border border-[#1A2B4A] rounded-[12px] py-2 z-50"
                      style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                    >
                      {link.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="block px-4 py-2.5 text-[14px] text-[#8C9BB5] hover:text-white hover:bg-[#1A2B4A] transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-[14px] font-medium text-[#8C9BB5] hover:text-white transition-colors rounded-[8px] hover:bg-[#1A2B4A]"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-[14px] font-medium text-[#8C9BB5] hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/apply"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] h-10 px-5 transition-all duration-150"
              style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628', boxShadow: '0 2px 8px rgba(201,168,76,0.3)' }}
            >
              Get Pre-Qualified
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-[8px] text-[#8C9BB5] hover:text-white hover:bg-[#1A2B4A] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-[#1A2B4A] bg-[#070E1A]">
          <nav className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-3 py-2.5 text-[15px] font-medium text-[#8C9BB5] hover:text-white rounded-[8px] hover:bg-[#1A2B4A] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-[#1A2B4A] flex flex-col gap-2">
              <Link
                href="/login"
                className="px-3 py-2.5 text-[15px] font-medium text-[#8C9BB5] hover:text-white rounded-[8px] hover:bg-[#1A2B4A] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/apply"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all w-full text-center"
                style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628' }}
                onClick={() => setMenuOpen(false)}
              >
                Get Pre-Qualified
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}