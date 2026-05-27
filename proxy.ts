import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isInternalCrmRole } from '@/lib/auth-routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

type UserProfile = {
  role: string;
  is_active: boolean;
};

function redirect(req: NextRequest, pathname: string) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl);
}

function redirectToAccessDenied(req: NextRequest, reason: string) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = '/access-denied';
  redirectUrl.search = '';
  redirectUrl.searchParams.set('reason', reason);
  redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

function redirectToLogin(req: NextRequest, redirectPath = req.nextUrl.pathname) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = '/login';
  redirectUrl.searchParams.set('redirectTo', redirectPath);
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const pathname = req.nextUrl.pathname;
  const host = req.headers.get('host')?.split(':')[0].toLowerCase() ?? '';
  const isCrmHost = host.startsWith('crm.');

  if (process.env.E2E_AUTH_BYPASS === '1' && (pathname.startsWith('/crm') || pathname.startsWith('/portal'))) {
    return res;
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/crm', '/portal'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isLoginRoute = pathname === '/login';
  const isCrmHostRoot = isCrmHost && pathname === '/';

  if (!isProtectedRoute && !isLoginRoute && !isCrmHostRoot) {
    return res;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Redirect to login if accessing protected route without session
  if ((isProtectedRoute || isCrmHostRoot) && !user) {
    return redirectToLogin(req, isCrmHostRoot ? '/crm' : pathname);
  }

  if (!user) {
    return res;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('user_id', user.id)
    .maybeSingle() as { data: UserProfile | null };

  if (!profile) {
    if (isProtectedRoute || isLoginRoute || isCrmHostRoot) {
      return redirectToAccessDenied(req, 'access_not_configured');
    }

    return res;
  }

  if (!profile.is_active) {
    if (isProtectedRoute || isLoginRoute || isCrmHostRoot) {
      return redirectToAccessDenied(req, 'account_inactive');
    }

    return res;
  }

  const isClientRole = profile.role === 'client';
  const isInternalRole = isInternalCrmRole(profile.role);

  if (isCrmHostRoot) {
    if (isInternalRole) return redirect(req, '/crm');
    if (isClientRole) return redirect(req, '/portal');
    return redirectToAccessDenied(req, 'crm_access_denied');
  }

  // Redirect logged-in users away from login based on their profile role.
  if (isLoginRoute) {
    if (isClientRole) {
      return redirect(req, '/portal');
    }

    if (isInternalRole) {
      return redirect(req, '/crm');
    }

    return redirectToAccessDenied(req, 'crm_access_denied');
  }

  if (pathname.startsWith('/crm') && !isInternalRole) {
    return redirectToAccessDenied(req, isClientRole ? 'client_portal_only' : 'crm_access_denied');
  }

  if (pathname.startsWith('/portal') && !isClientRole) {
    if (isInternalRole) {
      return redirect(req, '/crm');
    }

    return redirectToAccessDenied(req, 'portal_access_denied');
  }

  return res;
}

export const config = {
  matcher: ['/', '/crm/:path*', '/portal/:path*', '/login'],
};
