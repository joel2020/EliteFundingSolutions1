'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartBar as BarChart3,
  Archive,
  BookOpen,
  Briefcase,
  Building2,
  DollarSign,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Tag,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCrmUser } from '@/lib/crm-auth';

const ADMIN_NAV_ROLES = ['super_admin', 'admin'];
const FINANCE_NAV_ROLES = ['super_admin', 'admin', 'manager'];

const navItems = [
  { href: '/crm', label: 'Dashboard', icon: LayoutDashboard, group: 'Core' },
  { href: '/crm/pipeline', label: 'Pipeline', icon: GitBranch, group: 'Core' },
  { href: '/crm/deals', label: 'Deals', icon: Search, group: 'Core' },
  { href: '/crm/applications', label: 'Applications', icon: FileText, group: 'Core' },
  { href: '/crm/leads', label: 'Leads', icon: Tag, group: 'Core' },
  { href: '/crm/prospects', label: 'Prospects', icon: Tag, group: 'Core' },
  { href: '/crm/partners', label: 'Funders', icon: Building2, group: 'Funding' },
  { href: '/crm/iso-brokers', label: 'ISOs', icon: Users, group: 'Funding' },
  { href: '/crm/portfolio', label: 'Portfolio', icon: Briefcase, group: 'Funding' },
  { href: '/crm/vault', label: 'The Vault', icon: Archive, group: 'Funding' },
  { href: '/crm/knowledge-base', label: 'Knowledge Base', icon: BookOpen, group: 'Operations' },
  { href: '/crm/renewals', label: 'Renewals', icon: RefreshCw, group: 'Operations' },
  { href: '/crm/earnings', label: 'Earnings', icon: DollarSign, group: 'Operations', roles: FINANCE_NAV_ROLES },
  { href: '/crm/reports', label: 'Reports', icon: BarChart3, group: 'Operations', roles: FINANCE_NAV_ROLES },
  { href: '/crm/tools', label: 'Tools', icon: Wrench, group: 'Admin', roles: ADMIN_NAV_ROLES },
  { href: '/crm/users', label: 'Users', icon: Users, group: 'Admin', roles: ADMIN_NAV_ROLES },
  { href: '/crm/settings', label: 'Settings', icon: Settings, group: 'Admin', roles: ADMIN_NAV_ROLES },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useCrmUser();
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
    <header className="z-40 shrink-0 border-b border-[#D8E1EC] bg-white/95 text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur" data-testid="crm-nexus-shell">
      <div className="flex min-h-[76px] flex-col gap-3 px-3 py-3 xl:flex-row xl:items-center xl:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border border-[#D8E1EC] bg-[#F8FAFC] shadow-sm">
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
            <div className="truncate text-[14px] font-bold leading-tight text-[#0F172A]">Elite CRM Nexus v2</div>
            <div className="truncate text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-[#A87811]">Elite Funding Solutions</div>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto xl:justify-center" aria-label="CRM navigation">
          {navItems.filter((item) => !item.roles || item.roles.includes(profile?.role || '')).map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                title={`${item.group}: ${item.label}`}
                className={`crm-focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-bold transition-all ${
                  active
                    ? 'bg-[#0B1F3F] text-white shadow-[0_8px_18px_rgba(15,43,91,0.18)]'
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
            className="crm-focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-[12px] font-bold text-[#334155] hover:bg-[#F8FAFC]"
          >
            <Search className="h-3.5 w-3.5" />
            Search Deals
          </Link>
          <Link
            href="https://elitefundingsolution.com/"
            prefetch={false}
            className="crm-focus-ring inline-flex h-9 shrink-0 items-center rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F2B5B] hover:bg-[#EEF2F7]"
          >
            Elite Connect
          </Link>
          <Link
            href="/crm/settings"
            prefetch={false}
            aria-label="Profile settings"
            className="crm-focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          >
            <UserCircle className="h-4 w-4" />
          </Link>
          <button
            data-testid="crm-sign-out"
            onClick={handleLogout}
            className="crm-focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[#FECACA] bg-white px-3 text-[12px] font-bold text-[#B91C1C] hover:bg-[#FEF2F2]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
