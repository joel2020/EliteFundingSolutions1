-- Gmail Permission Hardening (2026-05-20)
-- Replace overly-broad GRANT ALL with explicit minimum-required grants.
-- RLS policies remain the primary access control mechanism; this is
-- a defense-in-depth measure at the PostgreSQL privilege layer.

-- gmail_tokens: revoke blanket grant, re-grant only DML needed by app
REVOKE ALL ON gmail_tokens FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gmail_tokens TO authenticated;

-- email_logs: revoke blanket grant, re-grant only DML needed by app
-- Note: email_logs is append-only in practice (no UPDATE/DELETE by users),
-- but retained here to match existing RLS INSERT + SELECT policies.
REVOKE ALL ON email_logs FROM authenticated;
GRANT SELECT, INSERT ON email_logs TO authenticated;
