'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  // On mount, exchange the token in the URL hash for a session
  useEffect(() => {
    const handleTokenFromHash = async () => {
      if (!supabase) {
        setErrorMsg('Authentication is not configured. Missing Supabase public environment variables.')
        setStatus('error')
        return
      }
      const searchParams = new URLSearchParams(window.location.search)
      const authCode = searchParams.get('code')
      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode)
        if (error) {
          setErrorMsg('This invite link is invalid or has expired. Please ask your admin to resend the invite.')
          setStatus('error')
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setSessionReady(true)
        setStatus('ready')
        return
      }

      // Supabase puts the token in the URL hash: #access_token=...&type=invite
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')

      if (accessToken && (type === 'invite' || type === 'recovery' || type === 'signup')) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })

        if (error) {
          setErrorMsg('This invite link is invalid or has expired. Please ask your admin to resend the invite.')
          setStatus('error')
          return
        }

        // Clear the token from the URL for security
        window.history.replaceState(null, '', window.location.pathname)
        setSessionReady(true)
        setStatus('ready')
      } else if (!accessToken) {
        // Check if user already has a valid session (e.g. refreshed the page)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setSessionReady(true)
          setStatus('ready')
        } else {
          setErrorMsg('No invite token found. Please use the link from your invitation email.')
          setStatus('error')
        }
      } else {
        setErrorMsg('This link type is not supported for password setup.')
        setStatus('error')
      }
    }

    handleTokenFromHash()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    if (!supabase) {
      setErrorMsg('Authentication is not configured. Missing Supabase public environment variables.')
      setStatus('error')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrorMsg(error.message || 'Failed to set password. Please try again.')
      setStatus('ready')
      return
    }

    setStatus('success')

    await fetch('/api/auth/invite-accepted', { method: 'POST' }).catch(() => null)

    // Get the user's CRM profile and redirect accordingly
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()
      : { data: null }
    const role = profile?.role || user?.user_metadata?.role || user?.app_metadata?.role

    setTimeout(() => router.push(role === 'client' ? '/portal' : '/crm'), 2000)
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your invite link...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <a href="/" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Set!</h1>
          <p className="text-gray-600">Redirecting you to your dashboard...</p>
        </div>
      </div>
    )
  }

  // status === 'ready' | 'submitting'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Password</h1>
          <p className="text-gray-500 mt-2">Welcome to Elite Funding Solutions. Set your password to get started.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors"
            >
              {status === 'submitting' ? 'Setting Password...' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
