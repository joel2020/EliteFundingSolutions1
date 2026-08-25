import { test, expect } from '@playwright/test';
import { NextResponse } from 'next/server';
import * as serverAuth from '../lib/server-auth';

test('clears only Supabase auth cookies after an invalid refresh token', () => {
  const clearSupabaseAuthCookies = (serverAuth as Record<string, any>).clearSupabaseAuthCookies;
  expect(typeof clearSupabaseAuthCookies).toBe('function');

  const response = NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  clearSupabaseAuthCookies(response, [
    { name: 'sb-mdrrcrmowurbrwvdsgnq-auth-token', value: 'stale-session' },
    { name: 'sb-mdrrcrmowurbrwvdsgnq-auth-token.0', value: 'stale-session-part' },
    { name: 'sb-anotherproject-auth-token', value: 'other-project-session' },
    { name: 'sb-mdrrcrmowurbrwvdsgnq-auth-token.backup', value: 'backup-session' },
    { name: 'theme', value: 'dark' },
  ]);

  const setCookie = response.headers.get('set-cookie') || '';
  expect(setCookie).toContain('sb-mdrrcrmowurbrwvdsgnq-auth-token=;');
  expect(setCookie).toContain('sb-mdrrcrmowurbrwvdsgnq-auth-token.0=;');
  expect(setCookie).not.toContain('sb-anotherproject-auth-token=;');
  expect(setCookie).not.toContain('sb-mdrrcrmowurbrwvdsgnq-auth-token.backup=;');
  expect(setCookie).not.toContain('theme=;');
});
