/*
  Harden browser Data API access for server-mediated flows.

  Gmail tokens and email logs are now accessed only through authenticated
  server routes with the Supabase service role. Public application intake also
  goes through /api/applications/submit, so anonymous browser inserts into the
  backing tables are no longer needed.
*/

drop policy if exists "Users can view own gmail tokens" on public.gmail_tokens;
drop policy if exists "Users can insert own gmail tokens" on public.gmail_tokens;
drop policy if exists "Users can update own gmail tokens" on public.gmail_tokens;
drop policy if exists "Users can delete own gmail tokens" on public.gmail_tokens;

revoke all on table public.gmail_tokens from anon;
revoke all on table public.gmail_tokens from authenticated;
grant all on table public.gmail_tokens to service_role;

drop policy if exists "Service role manages gmail tokens" on public.gmail_tokens;
create policy "Service role manages gmail tokens"
  on public.gmail_tokens
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users can view org email logs" on public.email_logs;
drop policy if exists "Users can insert email logs" on public.email_logs;

revoke all on table public.email_logs from anon;
revoke all on table public.email_logs from authenticated;
grant all on table public.email_logs to service_role;

drop policy if exists "Service role manages email logs" on public.email_logs;
create policy "Service role manages email logs"
  on public.email_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Public can insert applications" on public.applications;
revoke all on table public.applications from anon;

drop policy if exists "Anon can insert existing advances" on public.existing_advances;
revoke all on table public.existing_advances from anon;
