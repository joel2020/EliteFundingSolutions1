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
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Send,
  Tag,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCrmUser } from '@/lib/crm-auth';

const staffRoles = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'viewer'];
const adminRoles = ['super_admin', 'admin'];
const underwritingRoles = ['super_admin', 'admin', 'manager', 'processor', 'underwriter'];
const externalRoles = ['funder', 'iso_broker', 'broker', 'referral_partner'];

const navItems = [
  { href: '/crm', label: 'Dashboard', icon: LayoutDashboard, roles: [...staffRoles, ...externalRoles] },
  { href: '/crm/deals', label: 'Deals', icon: Search, roles: [...staffRoles, ...externalRoles] },
  { href: '/crm/applications', label: 'Applications', icon: FileText, roles: staffRoles },
  { href: '/crm/leads', label: 'Leads', icon: Tag, roles: staffRoles },
  { href: '/crm/underwriting', label: 'Underwriting', icon: ClipboardList, roles: underwritingRoles },
  { href: '/crm/offers', label: 'Offers', icon: Send, roles: [...staffRoles, 'funder'] },
  { href: '/crm/partners', label: 'Funders', icon: Building2, roles: staffRoles },
  { href: '/crm/iso-brokers', label: 'ISOs / Partners', icon: Users, roles: staffRoles },
  { href: '/crm/tasks', label: 'Tasks', icon: ClipboardList, roles: staffRoles },
  { href: '/crm/renewals', label: 'Renewals', icon: RefreshCw, roles: staffRoles },
  { href: '/crm/earnings', label: 'Earnings', icon: DollarSign, roles: staffRoles },
  { href: '/crm/reports', label: 'Reports', icon: BarChart3, roles: staffRoles },
  { href: '/crm/archive', label: 'Archive', icon: FileArchive, roles: adminRoles },
  { href: '/crm/tools', label: 'Tools', icon: Wrench, roles: staffRoles },
  { href: '/crm/users', label: 'Users & Access', icon: Users, roles: adminRoles },
  { href: '/crm/settings', label: 'Settings', icon: Settings, roles: [...staffRoles, ...externalRoles] },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useCrmUser();
  const [collapsed, setCollapsed] = useState(false);
  const authClient = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build'
  ), []);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('elite-crm-sidebar-collapsed') === 'true');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('elite-crm-sidebar-collapsed', String(next));
      return next;
    });
  };

  const visibleNavItems = navItems.filter((item) => !profile?.role || item.roles.includes(profile.role));
  const isActive = (href: string) => href === '/crm' ? pathname === '/crm' : pathname.startsWith(href);

  const handleLogout = async () => {
    await authClient.auth.signOut();
    router.push('/login');
  };

  return (
    <aside
      className={`z-40 flex shrink-0 flex-col border-b border-[#E2E8F0] bg-white text-[#0F172A] shadow-[1px_0_2px_rgba(15,23,42,0.05)] transition-[width] duration-200 lg:h-screen lg:border-b-0 lg:border-r ${collapsed ? 'lg:w-[92px]' : 'lg:w-[276px]'}`}
      data-testid="crm-nexus-shell"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="flex min-h-[68px] items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 lg:min-h-[76px]">
        <Link href="/crm" prefetch={false} className="flex min-w-0 items-center gap-3" title="Elite CRM Nexus v2">
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
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="truncate text-[13px] font-semibold leading-tight text-[#0F172A]">Elite CRM Nexus v2</div>
            <div className="truncate text-[11px] font-semibold uppercase leading-tight tracking-normal text-[#C9A84C]">Elite Funding Solutions</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] lg:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <Link
          href="/crm/settings"
          prefetch={false}
          aria-label="Profile settings"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] lg:hidden"
        >
          <UserCircle className="h-4 w-4" />
        </Link>
      </div>

      <nav className={`flex gap-1 overflow-x-auto px-3 py-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto ${collapsed ? 'lg:items-center lg:px-2' : ''}`} aria-label="CRM navigation">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-[7px] px-3 text-[13px] font-semibold transition-colors ${collapsed ? 'lg:w-10 lg:justify-center lg:px-0' : 'lg:w-full'} ${
                active
                  ? 'bg-[#0F2B5B] text-white shadow-[0_8px_18px_rgba(15,43,91,0.18)]'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={`hidden border-t border-[#E2E8F0] p-3 lg:block ${collapsed ? 'lg:px-2' : ''}`}>
        <Link
          href="/crm/deals"
          prefetch={false}
          title="Search Deals"
          className={`mb-2 inline-flex h-10 w-full items-center gap-2 rounded-[7px] border border-[#CBD5E1] bg-white px-3 text-[12px] font-semibold text-[#334155] hover:bg-[#F8FAFC] ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <Search className="h-3.5 w-3.5" />
          <span className={collapsed ? 'lg:hidden' : ''}>Search Deals</span>
        </Link>
        <Link
          href="https://elitefundingsolution.com/"
          prefetch={false}
          title="Elite Connect"
          className={`mb-2 inline-flex h-10 w-full items-center rounded-[7px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] font-semibold text-[#0F2B5B] hover:bg-[#EEF2F7] ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {collapsed ? <Building2 className="h-3.5 w-3.5" /> : 'Elite Connect'}
        </Link>
        <button
          data-testid="crm-sign-out"
          onClick={handleLogout}
          title="Logout"
          className={`inline-flex h-10 w-full items-center gap-2 rounded-[7px] border border-[#FECACA] bg-white px-3 text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
