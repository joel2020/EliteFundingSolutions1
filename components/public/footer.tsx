import Link from 'next/link';
import Image from 'next/image';

const footerLinks = {
  'Funding': [
    { label: 'Merchant Cash Advance', href: '/funding-solutions#mca' },
    { label: 'Working Capital Line', href: '/funding-solutions#wcl' },
    { label: 'Equipment Financing', href: '/funding-solutions#equipment' },
    { label: 'Invoice Factoring', href: '/funding-solutions#invoice' },
    { label: 'Get Pre-Qualified', href: '/apply' },
  ],
  'Company': [
    { label: 'About Us', href: '/about' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Industries', href: '/industries' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ],
  'Resources': [
    { label: 'FAQ', href: '/faq' },
    { label: 'Funding Guide', href: '/resources' },
    { label: 'Business Calculator', href: '/calculator' },
    { label: 'Partner With Us', href: '/partners' },
  ],
  'Legal': [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-[#040B16] text-[#F0F4FF] border-t border-[#0F1E35]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-0 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="relative w-9 h-9 rounded-[8px] overflow-hidden bg-[#0F1E35] flex items-center justify-center shrink-0">
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
            <p className="text-[14px] text-[#5A6A85] leading-relaxed mb-6 max-w-[260px]">
              Fast, flexible capital for ambitious businesses. Funding decisions in hours — backed by an elite network of 50+ lenders.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+18884002580"
                className="text-[14px] text-[#5A6A85] hover:text-[#C9A84C] transition-colors"
              >
                (888) 400-2580
              </a>
              <a
                href="mailto:hello@elitefundingsolutions.com"
                className="text-[14px] text-[#5A6A85] hover:text-[#C9A84C] transition-colors"
              >
                hello@elitefundingsolutions.com
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#C9A84C] mb-4">
                {group}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-[#5A6A85] hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[#0F1E35] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-[#3A4A65]">
            &copy; {new Date().getFullYear()} Elite Funding Solutions LLC. All rights reserved.
          </p>
          <p className="text-[12px] text-[#2A3A55] text-center md:text-right max-w-lg">
            Elite Funding Solutions is a commercial funding company. We are not a bank. Rates and terms vary based on business qualifications. Not available in all states.
          </p>
        </div>
      </div>
    </footer>
  );
}
