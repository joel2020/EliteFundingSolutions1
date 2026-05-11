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
    <header className="h-16 bg-white border-b border-[#DDE3EF] flex items-center px-8 shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-[18px] font-semibold text-[#0A1628] leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#8C9BB5] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 ml-4">
        {actions}
        <button className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[#5A6A85] hover:bg-[#F1F3F7] transition-colors">
          <Search className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[#5A6A85] hover:bg-[#F1F3F7] transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
        </button>
        <Link
          href="/crm/settings"
          className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[#5A6A85] hover:bg-[#F1F3F7] transition-colors"
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
