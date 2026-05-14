'use client';

import { Bell, Search, Settings } from 'lucide-react';
import Link from 'next/link';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function CrmTopbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-[#E2E8F0] flex items-center px-4 md:px-6 shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-semibold text-[#0F172A] leading-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 ml-4">
        {actions}
        <button className="hidden h-9 items-center gap-2 rounded-[7px] border border-[#E2E8F0] px-3 text-[12px] font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] lg:flex">
          <Search className="w-4 h-4" />
          Search CRM
        </button>
        <button className="w-9 h-9 rounded-[7px] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
        </button>
        <Link
          href="/crm/settings"
          className="w-9 h-9 rounded-[7px] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#0A1628] text-[13px] font-bold ml-1" style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)' }}>
          E
        </div>
      </div>
    </header>
  );
}
