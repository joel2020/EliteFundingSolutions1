'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

const messages: Record<string, string> = {
  access_not_configured: 'Your sign-in worked, but CRM access is not configured for this account yet. Ask an admin to finish your CRM user setup.',
  account_inactive: 'Your account is inactive. Ask an admin to reactivate CRM access.',
  crm_access_denied: 'This account is authenticated, but it is not authorized for CRM access.',
  client_portal_only: 'This account is set up for the client portal, not CRM access.',
  portal_access_denied: 'This account is not authorized for the client portal.',
};

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'crm_access_denied';
  const message = messages[reason] || reason;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#061326] p-6">
      <div className="w-full max-w-[460px] rounded-[18px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-[12px] bg-red-500/10 text-red-200">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mb-3 text-[24px] font-bold text-white">Access not configured</h1>
        <p className="mb-7 text-[14px] leading-6 text-[#A8B3C7]">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#C9A84C] px-5 text-[14px] font-semibold text-[#0A1628]"
          >
            Back to login
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-white/12 px-5 text-[14px] font-semibold text-white"
          >
            Public site
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#061326]" />}>
      <AccessDeniedContent />
    </Suspense>
  );
}
