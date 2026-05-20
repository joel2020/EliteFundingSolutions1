'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  // On mount, exchange the token in the URL hash for a session
  useEffect(() => {
    const handleTokenFromHash = async () => {
      // Supabase puts the token in the URL hash: #access_token=...&type=invite
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && (type === 'invite' || type === 'recovery' || type === 'signup')) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        if (error) {
          setErrorMsg('This invite link is invalid or has expired. Please ask your admin to resend the invite.');
          setStatus('error');
          return;
        }
        // Clear the token from the URL for security
        window.history.replaceState(null, '', window.location.pathname);
        setSessionReady(true);
        setStatus('ready');
      } else {
        // No token in hash — check if there's already an active session (e.g. page refresh)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
          setStatus('ready');
        } else {
          setErrorMsg('No invite token found. Please use the link from your invitation email.');
          setStatus('error');
        }
      }
    };

    handleTokenFromHash();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setStatus('submitting');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setStatus('ready');
      return;
    }

    setStatus('success');

    // Redirect based on role after a brief success moment
    setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;
      if (role === 'iso_broker') {
        router.push('/portal');
      } else {
        router.push('/crm');
      }
    }, 1500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f6f2',
      padding: '24px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            marginBottom: '16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 6px 0' }}>
            {status === 'success' ? 'Password Set!' : 'Create Your Password'}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {status === 'success'
              ? 'Redirecting you to your account…'
              : 'Welcome to Elite Funding Solutions. Set a secure password to get started.'}
          </p>
        </div>

        {/* Loading state */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '20px 0' }}>
            Verifying your invite link…
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '16px',
            color: '#dc2626',
            fontSize: '14px',
            lineHeight: '1.5',
            textAlign: 'center',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Success state */}
        {status === 'success' && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '16px',
            color: '#16a34a',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            ✓ Your password has been set. Taking you to your dashboard…
          </div>
        )}

        {/* Password form */}
        {(status === 'ready' || status === 'submitting') && (
          <form onSubmit={handleSubmit}>
            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '20px',
              }}>
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                width: '100%',
                padding: '12px',
                background: status === 'submitting' ? '#93c5fd' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {status === 'submitting' ? 'Setting password…' : 'Set Password & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
