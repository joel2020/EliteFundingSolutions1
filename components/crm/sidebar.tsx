'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartBar as BarChart3,
  Building2,
  ClipboardList,
  DollarSign,
  FileArchive,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Send,
  Tag,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const navItems = [
  { href: '/crm', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm/leads', label: 'Leads', icon: Tag },
  { href: '/crm/deals', label: 'Deals', icon: Search },
  { href: '/crm/underwriting', label: 'Underwriting', icon: FileText },
  { href: '/crm/offers', label: 'Offers', icon: Send },
  { href: '/crm/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/crm/partners', label: 'Funders', icon: Building2 },
  { href: '/crm/iso-brokers', label: 'ISO', icon: Users },
  { href: '/crm/renewals', label: 'Renewals', icon: RefreshCw },
  { href: '/crm/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/crm/reports', label: 'Reports', icon: BarChart3 },
  { href: '/crm/archive', label: 'Archive', icon: FileArchive },
  { href: '/crm/tools', label: 'Tools', icon: Wrench },
  { href: '/crm/users', label: 'Users', icon: Users },
  { href: '/crm/settings', label: 'Settings', icon: Settings },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const authClient = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build'
  ), []);

  const isActive = (href: string) =>
    href === '/crm' ? pathname === '/crm' : pathname.startsWith(href);

  const handleLogout = async () => {
    await authClient.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="z-40 shrink-0 border-b border-[#E2E8F0] bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.05)]" data-testid="crm-nexus-shell">
      <div className="flex min-h-[72px] flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
            <Image
              src="/elite-funding-logo.png"
              alt="Elite Funding Solutions"
              width={40}
              height={40}
              className="object-cover"
              priority
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-[#0F172A]">Elite CRM Nexus v2</div>
            <div className="truncate text-[11px] font-semibold uppercase leading-tight tracking-normal text-[#C9A84C]">Elite Funding Solutions</div>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:justify-center" aria-label="CRM navigation">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#0F2B5B] text-white'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
          <Link
            href="/crm/deals"
            prefetch={false}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[7px] border border-[#CBD5E1] bg-white px-3 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            <Search className="h-3.5 w-3.5" />
            Search Deals
          </Link>
          <Link
            href="https://elitefundingsolution.com/"
            prefetch={false}
            className="inline-flex h-9 shrink-0 items-center rounded-[7px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] font-semibold text-[#0F2B5B] hover:bg-[#EEF2F7]"
          >
            Elite Connect
          </Link>
          <Link
            href="/crm/settings"
            prefetch={false}
            aria-label="Profile settings"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          >
            <UserCircle className="h-4 w-4" />
          </Link>
          <button
            data-testid="crm-sign-out"
            onClick={handleLogout}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[7px] border border-[#FECACA] bg-white px-3 text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
