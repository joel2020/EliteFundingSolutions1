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
    <header className="sticky top-0 z-30 min-h-[72px] shrink-0 border-b border-[#D8E1EC] bg-white/88 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-h-[72px] items-center gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-[20px] font-bold leading-tight text-[#0F172A] tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] font-medium text-[#64748B]">{subtitle}</p>}
      </div>

      <div className="ml-4 flex items-center gap-2 overflow-x-auto">
        {actions}
        <Link href="/crm/deals" prefetch={false} className="crm-focus-ring hidden h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[#D8E1EC] bg-white px-3 text-[12px] font-bold text-[#475569] transition-colors hover:bg-[#F8FAFC] lg:flex">
          <Search className="w-4 h-4" />
          Search CRM
        </Link>
        <Link
          href="/crm/tasks"
          prefetch={false}
          title="Review open tasks and follow-ups"
          aria-label="Review open tasks and follow-ups"
          className="crm-focus-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-[#64748B] transition-colors hover:border-[#D8E1EC] hover:bg-white hover:text-[#0F172A]"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#C9A84C]" />
        </Link>
        <Link
          href="/crm/settings"
          prefetch={false}
          className="crm-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-[#64748B] transition-colors hover:border-[#D8E1EC] hover:bg-white"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <div className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#0A1628] shadow-sm" style={{ background: 'linear-gradient(135deg, #D9B95D 0%, #B8962E 100%)' }}>
          E
        </div>
      </div>
      </div>
    </header>
  );
}
