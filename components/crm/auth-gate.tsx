'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AuthState = 'loading' | 'authorized' | 'missing_profile' | 'inactive' | 'unauthorized';

export function CrmAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>('loading');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function verifyAccess() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id,email,role,is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;
      setEmail(user.email || 'this account');

      if (error || !profile) {
        setState('missing_profile');
        return;
      }

      if (!profile.is_active) {
        setState('inactive');
        return;
      }

      if (profile.role === 'client') {
        setState('unauthorized');
        return;
      }

      setState('authorized');
    }

    verifyAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (state === 'authorized') return <>{children}</>;

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-[#5A6A85]">
        Verifying secure CRM access…
      </div>
    );
  }

  const copy = {
    missing_profile: {
      title: 'CRM profile required',
      body: `You are signed in as ${email}, but this account is not connected to an Elite Funding CRM profile yet. Ask an administrator to create or activate your staff profile before accessing the CRM.`,
    },
    inactive: {
      title: 'CRM access inactive',
      body: `The CRM profile for ${email} is inactive. Contact an administrator if you believe this should be re-enabled.`,
    },
    unauthorized: {
      title: 'Staff access required',
      body: 'This area is limited to authorized Elite Funding staff. Client users should return to the client portal.',
    },
  }[state];

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-6">
      <div className="max-w-[520px] rounded-[24px] border border-[#DDE3EF] bg-white p-8 shadow-xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7E0] text-[#B8962E]">
          {state === 'unauthorized' ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        </div>
        <h1 className="text-2xl font-bold text-[#0A1628]">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5A6A85]">{copy.body}</p>
        <p className="mt-3 text-sm leading-6 text-[#5A6A85]">You are not stuck: sign out below, return to login, or contact your CRM administrator for access.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#0A1628] px-5 text-sm font-semibold text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
          <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#DDE3EF] px-5 text-sm font-semibold text-[#0A1628]">
            Return to login
          </Link>
          {state === 'unauthorized' && (
            <Link href="/portal" className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#DDE3EF] px-5 text-sm font-semibold text-[#0A1628]">
              Client portal
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
