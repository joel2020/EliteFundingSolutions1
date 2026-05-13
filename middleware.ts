import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INTERNAL_CRM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales_rep',
  'processor',
  'underwriter',
] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

type UserProfile = {
  role: string;
  is_active: boolean;
};

function isInternalCrmRole(role: string) {
  return INTERNAL_CRM_ROLES.includes(role as (typeof INTERNAL_CRM_ROLES)[number]);
}

function redirect(req: NextRequest, pathname: string) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl);
}

function redirectToLogin(req: NextRequest) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = '/login';
  redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const pathname = req.nextUrl.pathname;
  const host = req.headers.get('host')?.split(':')[0].toLowerCase() ?? '';
  const isCrmHost = host.startsWith('crm.');

  // CRM subdomains should open the CRM login experience by default.
  if (isCrmHost && pathname === '/') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/crm', '/portal'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isLoginRoute = pathname === '/login';

  if (!isProtectedRoute && !isLoginRoute) {
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
  } = await supabase.auth.getUser();

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !user) {
    return redirectToLogin(req);
  }

  if (!user) {
    return res;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('user_id', user.id)
    .maybeSingle() as { data: UserProfile | null };

  if (!profile || !profile.is_active) {
    if (isProtectedRoute) {
      return redirectToLogin(req);
    }

    return res;
  }

  const isClientRole = profile.role === 'client';
  const isInternalRole = isInternalCrmRole(profile.role);

  // Redirect logged-in users away from login based on their profile role.
  if (isLoginRoute) {
    if (isClientRole) {
      return redirect(req, '/portal');
    }

    if (isInternalRole) {
      return redirect(req, '/crm');
    }

    return res;
  }

  if (pathname.startsWith('/crm') && !isInternalRole) {
    if (isClientRole) {
      return redirect(req, '/portal');
    }

    return redirectToLogin(req);
  }

  if (pathname.startsWith('/portal') && !isClientRole) {
    if (isInternalRole) {
      return redirect(req, '/crm');
    }

    return redirectToLogin(req);
  }

  return res;
}

export const config = {
  matcher: ['/', '/crm/:path*', '/portal/:path*', '/login'],
};
