'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { LogOut, Search, Settings, UserCircle, Zap } from 'lucide-react';

const navItems = [
  { href: '/crm', label: 'Dashboard' },
  { href: '/crm/leads', label: 'Leads' },
  { href: '/crm/deals', label: 'Deals' },
  { href: '/crm/renewals', label: 'Renewals' },
  { href: '/crm/earnings', label: 'Earnings' },
  { href: '/crm/reports', label: 'Reports' },
  { href: '/crm/tools', label: 'Tools' },
  { href: '/crm/users', label: 'Users' },
  { href: '/crm/settings', label: 'Settings' },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const authClient = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build'
  ), []);

  const isActive = (href: string) => (href === '/crm' ? pathname === '/crm' : pathname.startsWith(href));

  const handleLogout = async () => {
    await authClient.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="fixed left-0 top-0 z-50 flex h-14 w-full items-center border-b border-[#E5E7EB] bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Link href="/crm" className="mr-5 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-[#111827]">
        <span className="text-[#0F2B5B]">elite</span><span className="text-[#4F46E5]">crm.</span>
      </Link>
      <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`whitespace-nowrap rounded-[4px] px-3 py-2 text-[12px] font-medium transition-colors ${
              isActive(item.href) ? 'bg-[#EEF2FF] text-[#4338CA]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden h-9 w-[220px] items-center gap-2 rounded-[4px] border border-[#E2E8F0] bg-[#FAFAFB] px-3 text-[12px] text-[#94A3B8] xl:flex">
          <Search className="h-3.5 w-3.5" />
          Search Deals
        </div>
        <Link href="/crm/tools" className="hidden h-9 items-center gap-2 rounded-[4px] border border-[#E2E8F0] px-3 text-[12px] font-medium text-[#64748B] xl:flex">
          <Zap className="h-3.5 w-3.5 text-[#F59E0B]" />
          Elite Connect
        </Link>
        <Link href="/crm/settings" className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#64748B] hover:bg-[#F8FAFC]"><Settings className="h-4 w-4" /></Link>
        <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[#64748B] hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /></button>
        <div className="flex h-9 items-center gap-2 rounded-[4px] px-2 text-[12px] font-semibold text-[#0F172A]"><UserCircle className="h-5 w-5 text-[#4F46E5]" />User</div>
      </div>
    </header>
  );
}
