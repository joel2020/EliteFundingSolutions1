'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Users, Layers, ClipboardCheck, Tag, FolderOpen, RefreshCw, DollarSign, ChartBar as BarChart3, Settings, LogOut, Shield, ChevronDown, Search, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const navSections = [
  {
    label: null,
    items: [
      { href: '/crm', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/crm/leads', label: 'Leads', icon: Tag },
      { href: '/crm/deals', label: 'Deals', icon: Layers },
      { href: '/crm/earnings', label: 'Earnings', icon: DollarSign },
      { href: '/crm/reports', label: 'Reports', icon: BarChart3 },
      { href: '/crm/tools', label: 'Tools', icon: Wrench },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/crm/applications', label: 'Applications', icon: FileText },
      { href: '/crm/underwriting', label: 'Underwriting Queue', icon: ClipboardCheck },
      { href: '/crm/offers', label: 'Offers', icon: Tag },
      { href: '/crm/documents', label: 'Documents', icon: FolderOpen },
      { href: '/crm/renewals', label: 'Renewals', icon: RefreshCw },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/crm/users', label: 'Users', icon: Users },
      { href: '/crm/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const authClient = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build'
  ), []);

  useEffect(() => {
    document.documentElement.style.setProperty('--crm-sidebar-width', collapsed ? '64px' : '260px');
  }, [collapsed]);

  const isActive = (href: string) =>
    href === '/crm' ? pathname === '/crm' : pathname.startsWith(href);

  const handleLogout = async () => {
    await authClient.auth.signOut();
    router.push('/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full hidden md:flex flex-col transition-all duration-200 z-40 ${
        collapsed ? 'w-[64px]' : 'w-[260px]'
      }`}
      style={{ background: '#07111F', borderRight: '1px solid #172033' }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0" style={{ borderBottom: '1px solid #172033' }}>
        <div className="relative w-8 h-8 rounded-[8px] overflow-hidden shrink-0 bg-[#0F1E35]">
          <Image
            src="/elite-funding-logo.png"
            alt="Elite Funding Solutions"
            width={32}
            height={32}
            className="object-cover"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white truncate leading-tight">Elite Funding</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C9A84C] leading-tight">Solutions CRM</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto transition-colors shrink-0"
          style={{ color: '#3A4A65' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8C9BB5')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#3A4A65')}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid #172033' }}>
          <div className="flex h-9 items-center gap-2 rounded-[8px] border border-[#1E2A44] bg-[#0B1628] px-3 text-[12px] text-[#75839B]">
            <Search className="h-3.5 w-3.5" />
            Global search
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-1' : ''}>
            {section.label && !collapsed && (
              <div
                className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: '#C9A84C' }}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className="flex items-center gap-3 px-3 py-2 rounded-[7px] text-[13px] font-medium transition-all duration-100 mb-0.5"
                  style={{
                    background: active ? 'rgba(201,168,76,0.14)' : 'transparent',
                    color: active ? '#F0D27A' : '#7B8AA4',
                    fontWeight: active ? '600' : '500',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.color = '#8C9BB5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#5A6A85';
                    }
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3" style={{ borderTop: '1px solid #111E35' }}>
        <Link
          href="https://elitefundingsolution.com/"
          prefetch={false}
          className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors mb-0.5"
          style={{ color: '#5A6A85' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#8C9BB5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#5A6A85';
          }}
        >
          <Shield className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Public Site</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors"
          style={{ color: '#5A6A85' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            e.currentTarget.style.color = '#EF4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#5A6A85';
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
