'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check profile and route accordingly
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle() as { data: { role: string } | null };

      if (profile?.role === 'client') {
        router.push('/portal');
      } else {
        router.push('/crm');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #040B16 0%, #060F1E 50%, #0A1628 100%)' }}>
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 justify-center">
            <div className="relative w-9 h-9 rounded-[8px] overflow-hidden bg-[#0F1E35]">
              <Image
                src="/Elite_Funding_Solutions_Logo_Final.jpg"
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
                <Link href="/forgot-password" className="text-[12px] hover:underline" style={{ color: '#C9A84C' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
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
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[15px] h-11 px-6 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #B8962E 100%)', color: '#0A1628', boxShadow: '0 4px 16px rgba(201,168,76,0.25)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[13px]" style={{ color: '#3A4A65' }}>
              New client?{' '}
              <Link href="/apply" className="font-medium hover:underline" style={{ color: '#C9A84C' }}>
                Apply for funding
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[12px]" style={{ color: '#2A3A55' }}>
          <Shield className="w-3.5 h-3.5" />
          <span>256-bit SSL encrypted. SOC 2 Type II compliant.</span>
        </div>
      </div>
    </div>
  );
}
