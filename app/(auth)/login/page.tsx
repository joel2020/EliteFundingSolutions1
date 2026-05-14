'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';

const INTERNAL_CRM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales_rep',
  'processor',
  'underwriter',
] as const;

type UserProfile = {
  role: string;
  is_active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function isInternalCrmRole(role: string) {
  return INTERNAL_CRM_ROLES.includes(role as (typeof INTERNAL_CRM_ROLES)[number]);
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, supabaseAnonKey),
    []
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/crm`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google login failed';
      toast.error(msg);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Login failed');

      // Check profile and route accordingly
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role,is_active')
        .eq('user_id', data.user.id)
        .maybeSingle() as { data: UserProfile | null; error: Error | null };

      if (profileError) throw profileError;

      if (!profile) {
        await supabase.auth.signOut();
        toast.error('No CRM profile found. Contact admin.');
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        toast.error('This account is inactive.');
        return;
      }

      router.refresh();

      if (profile.role === 'client') {
        router.push('/portal');
      } else if (isInternalCrmRole(profile.role)) {
        router.push('/crm');
      } else {
        await supabase.auth.signOut();
        toast.error('This account is not authorized for CRM access.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#061326] p-6">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" prefetch={false} className="inline-flex items-center gap-3 justify-center">
            <div className="relative w-9 h-9 rounded-[8px] overflow-hidden bg-[#0F1E35]">
              <Image
                src="/elite-funding-logo.png"
                alt="Elite Funding Solutions"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-[15px] text-white tracking-tight leading-tight">Elite Funding</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C] leading-tight">Solutions</span>
            </div>
          </Link>
        </div>

        <div
          className="rounded-[20px] p-8 backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
        >
          <h1 className="text-[22px] font-bold text-white mb-1">Sign In</h1>
          <p className="text-[14px] mb-7" style={{ color: '#5A6A85' }}>
            Access your CRM or client portal.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#8C9BB5' }}>Email Address</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-[10px] px-[14px] text-[15px] transition-all duration-150 placeholder-[#3A4A65]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.08)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium" style={{ color: '#8C9BB5' }}>Password</label>
                <Link href="/forgot-password" prefetch={false} className="text-[12px] hover:underline" style={{ color: '#C9A84C' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-[10px] px-[14px] pr-10 text-[15px] transition-all duration-150 placeholder-[#3A4A65]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.08)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#3A4A65' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#C9A84C', color: '#0A1628', boxShadow: '0 4px 16px rgba(201,168,76,0.25)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: '#3A4A65' }}>or</span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <button
            data-testid="login-google"
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleLogin}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[10px] px-6 text-[15px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4]">G</span>
            {googleLoading ? 'Opening Google...' : 'Continue with Google'}
          </button>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[13px]" style={{ color: '#3A4A65' }}>
              New client?{' '}
              <Link href="https://elitefundingsolution.com/apply" prefetch={false} className="font-medium hover:underline" style={{ color: '#C9A84C' }}>
                Apply for funding
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[12px]" style={{ color: '#2A3A55' }}>
          <Shield className="w-3.5 h-3.5" />
          <span>Secure CRM access for authorized Elite Funding Solutions users.</span>
        </div>
      </div>
    </div>
  );
}
