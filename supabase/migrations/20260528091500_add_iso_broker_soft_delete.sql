ALTER TABLE public.iso_brokers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_iso_brokers_active_org
  ON public.iso_brokers (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;
