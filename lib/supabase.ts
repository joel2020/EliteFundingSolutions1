import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

export const supabase = typeof window === 'undefined'
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createBrowserClient(supabaseUrl, supabaseAnonKey);

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
