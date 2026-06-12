-- Elite Funding CRM cleanup (Rohan requirements, June 12 2026)
-- 1) Collapse legacy pipeline stages onto the nine approved stages.
-- 2) Revoke pending funder CRM invites and deactivate funder CRM profiles.
-- 3) Allow admins/managers to mark broadcast notifications as read.

-- ---------- 1) Stage model migration ----------
WITH stage_map(old_slug, new_slug) AS (
  VALUES
    ('lead_captured', 'documents_requested'),
    ('application_started', 'documents_requested'),
    ('documents_received', 'application_submitted'),
    ('underwriting_review', 'application_submitted'),
    ('verification', 'application_submitted'),
    ('merchant_interview', 'application_submitted'),
    ('submission', 'application_submitted'),
    ('submitted_to_partners', 'application_submitted'),
    ('working_deal', 'application_submitted'),
    ('offers_received', 'approved'),
    ('offer_presented', 'approved'),
    ('approved_not_accepted', 'declined'),
    ('contract_sent', 'contract_requested'),
    ('in_funding', 'contract_signed'),
    ('lost_unresponsive', 'declined'),
    ('withdrawn', 'declined')
), updated AS (
  UPDATE public.deals d
  SET stage_slug = m.new_slug,
      updated_at = now()
  FROM stage_map m
  WHERE d.stage_slug = m.old_slug
  RETURNING d.id, d.organization_id, m.old_slug, m.new_slug, d.deleted_at
)
INSERT INTO public.deal_status_history (organization_id, deal_id, from_stage, to_stage, changed_by, notes)
SELECT organization_id, id, old_slug, new_slug, NULL,
       'Stage model migration: collapsed legacy stages onto the nine approved deal stages.'
FROM updated
WHERE deleted_at IS NULL;

-- Keep the pipeline_stages catalog aligned (defaulted was missing).
INSERT INTO public.pipeline_stages (organization_id, name, slug, color, position, is_terminal)
SELECT '00000000-0000-0000-0000-000000000001', 'Defaulted', 'defaulted', '#DC2626', 29, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages
  WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND slug = 'defaulted'
);

-- ---------- 2) Funders must not have CRM access ----------
UPDATE public.crm_access_invites
SET status = 'revoked', revoked_at = now(), updated_at = now()
WHERE role = 'funder' AND status NOT IN ('revoked', 'expired');

UPDATE public.user_profiles
SET is_active = false, updated_at = now()
WHERE role = 'funder' AND deleted_at IS NULL;

-- ---------- 3) Notifications: broadcasts can be marked read by staff ----------
DROP POLICY IF EXISTS "Users can update their CRM notifications" ON public.crm_notifications;
CREATE POLICY "Users can update their CRM notifications"
  ON public.crm_notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_user_profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
    OR (
      recipient_user_profile_id IS NULL
      AND organization_id IN (
        SELECT organization_id FROM public.user_profiles
        WHERE user_id = auth.uid()
          AND role IN ('super_admin','admin','manager')
      )
    )
  )
  WITH CHECK (
    recipient_user_profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
    OR (
      recipient_user_profile_id IS NULL
      AND organization_id IN (
        SELECT organization_id FROM public.user_profiles
        WHERE user_id = auth.uid()
          AND role IN ('super_admin','admin','manager')
      )
    )
  );
