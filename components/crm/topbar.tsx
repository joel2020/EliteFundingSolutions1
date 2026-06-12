'use client';

import { Bell, Search, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

type CrmNotification = {
  id: string;
  title: string;
  body?: string | null;
  severity?: string | null;
  status: string;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at: string;
};

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityDot(severity?: string | null) {
  if (severity === 'success') return '#059669';
  if (severity === 'warning') return '#D97706';
  if (severity === 'critical') return '#DC2626';
  return '#2563EB';
}

function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/crm/notifications', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success) {
        setNotifications(result.notifications || []);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch {
      // Notifications are best-effort; never break the topbar.
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const markAllRead = async () => {
    setLoading(true);
    await fetch('/api/crm/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    }).catch(() => null);
    setLoading(false);
    load();
  };

  const openNotification = async (notification: CrmNotification) => {
    fetch('/api/crm/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: notification.id }),
    }).catch(() => null);
    setNotifications((current) => current.map((row) => row.id === notification.id ? { ...row, status: 'read' } : row));
    setUnreadCount((current) => Math.max(0, current - (notification.status === 'unread' ? 1 : 0)));
    if (notification.resource_type === 'deals' && notification.resource_id) {
      setOpen(false);
      router.push(`/crm/deals/${notification.resource_id}`);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        data-testid="crm-notifications-bell"
        onClick={() => { setOpen((current) => !current); if (!open) load(); }}
        title="Notifications"
        aria-label={unreadCount ? `Notifications: ${unreadCount} unread` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-[7px] text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-w-[88vw] rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-sm font-semibold text-[#0F172A]">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} disabled={loading} className="text-xs font-semibold text-[#0F2B5B] hover:underline">
                {loading ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">No notifications yet. Application completions, document uploads, and funder sends will show here.</p>
            ) : notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={`block w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#F8FAFC] ${notification.status === 'unread' ? 'bg-[#F8FAFC]' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: notification.status === 'unread' ? severityDot(notification.severity) : '#CBD5E1' }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[#0F172A]">{notification.title}</span>
                    {notification.body && <span className="mt-0.5 block text-xs leading-5 text-[#64748B]">{notification.body}</span>}
                    <span className="mt-1 block text-[11px] text-[#94A3B8]">{timeAgo(notification.created_at)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
        <Link href="/crm/deals" prefetch={false} className="hidden h-9 items-center gap-2 rounded-[7px] border border-[#E2E8F0] px-3 text-[12px] font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] lg:flex">
          <Search className="w-4 h-4" />
          Search CRM
        </Link>
        <NotificationsBell />
        <Link
          href="/crm/settings"
          prefetch={false}
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
