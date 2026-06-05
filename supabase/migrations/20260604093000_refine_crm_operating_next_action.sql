/*
  # Refine CRM operating next action

  Makes stale-stage SLA breaches explicit in the database next-action view.
*/

CREATE OR REPLACE VIEW public.crm_deal_operating_signals
WITH (security_invoker = true) AS
WITH deal_rollups AS (
  SELECT
    d.organization_id,
    d.id AS deal_id,
    d.public_id AS deal_public_id,
    d.business_id,
    d.application_id,
    d.assigned_user_id,
    d.stage_slug,
    d.lead_source,
    d.requested_amount,
    d.approved_amount,
    d.funded_amount,
    d.funded_at,
    d.underwriting_score,
    d.risk_tier,
    d.funding_probability,
    d.compliance_blockers,
    d.disclosure_required,
    d.disclosure_signed_at,
    d.created_at,
    d.updated_at,
    b.legal_name AS business_legal_name,
    b.dba AS business_dba,
    CASE d.stage_slug
      WHEN 'lead_captured' THEN 1
      WHEN 'documents_requested' THEN 2
      WHEN 'application_submitted' THEN 1
      WHEN 'underwriting_review' THEN 2
      WHEN 'submitted_to_partners' THEN 1
      WHEN 'offers_received' THEN 1
      WHEN 'offer_presented' THEN 2
      WHEN 'contract_sent' THEN 1
      WHEN 'contract_signed' THEN 1
      WHEN 'renewal_eligible' THEN 5
      ELSE 3
    END AS stage_sla_days,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(d.updated_at, d.created_at))) / 86400)::integer) AS stage_age_days,
    COALESCE(dr.missing_required_documents, 0) AS missing_required_documents,
    COALESCE(dr.open_document_requests, 0) AS open_document_requests,
    COALESCE(doc.document_count, 0) AS document_count,
    COALESCE(doc.approved_document_count, 0) AS approved_document_count,
    COALESCE(o.offer_count, 0) AS offer_count,
    COALESCE(o.active_offer_count, 0) AS active_offer_count,
    COALESCE(o.accepted_offer_count, 0) AS accepted_offer_count,
    COALESCE(t.open_task_count, 0) AS open_task_count,
    COALESCE(t.overdue_task_count, 0) AS overdue_task_count,
    COALESCE(cardinality(d.compliance_blockers), 0)
      + CASE WHEN d.disclosure_required IS TRUE AND d.disclosure_signed_at IS NULL THEN 1 ELSE 0 END AS compliance_blocker_count
  FROM public.deals d
  LEFT JOIN public.businesses b ON b.id = d.business_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE required IS TRUE AND status NOT IN ('approved','waived')) AS missing_required_documents,
      COUNT(*) FILTER (WHERE status NOT IN ('approved','waived')) AS open_document_requests
    FROM public.document_requests request
    WHERE request.organization_id = d.organization_id
      AND (request.deal_id = d.id OR request.application_id = d.application_id)
  ) dr ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS document_count,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_document_count
    FROM public.documents document
    WHERE document.organization_id = d.organization_id
      AND (document.deal_id = d.id OR document.application_id = d.application_id)
  ) doc ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS offer_count,
      COUNT(*) FILTER (WHERE status IN ('received','presented')) AS active_offer_count,
      COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_offer_count
    FROM public.offers offer
    WHERE offer.organization_id = d.organization_id
      AND offer.deal_id = d.id
  ) o ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE status <> 'completed') AS open_task_count,
      COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < now()) AS overdue_task_count
    FROM public.tasks task
    WHERE task.organization_id = d.organization_id
      AND (task.deal_id = d.id OR task.application_id = d.application_id)
  ) t ON true
  WHERE d.deleted_at IS NULL
)
SELECT
  *,
  LEAST(100, GREATEST(0,
    COALESCE(underwriting_score, funding_probability, 50)
    - LEAST(24, GREATEST(0, stage_age_days - stage_sla_days) * 6)
    - LEAST(18, missing_required_documents * 4)
    - LEAST(18, overdue_task_count * 6)
    - CASE WHEN compliance_blocker_count > 0 THEN 14 ELSE 0 END
    + CASE WHEN accepted_offer_count > 0 THEN 8 WHEN active_offer_count > 0 THEN 4 ELSE 0 END
  ))::integer AS health_score,
  CASE
    WHEN LEAST(100, GREATEST(0,
      COALESCE(underwriting_score, funding_probability, 50)
      - LEAST(24, GREATEST(0, stage_age_days - stage_sla_days) * 6)
      - LEAST(18, missing_required_documents * 4)
      - LEAST(18, overdue_task_count * 6)
      - CASE WHEN compliance_blocker_count > 0 THEN 14 ELSE 0 END
      + CASE WHEN accepted_offer_count > 0 THEN 8 WHEN active_offer_count > 0 THEN 4 ELSE 0 END
    )) >= 80 THEN 'healthy'
    WHEN LEAST(100, GREATEST(0,
      COALESCE(underwriting_score, funding_probability, 50)
      - LEAST(24, GREATEST(0, stage_age_days - stage_sla_days) * 6)
      - LEAST(18, missing_required_documents * 4)
      - LEAST(18, overdue_task_count * 6)
      - CASE WHEN compliance_blocker_count > 0 THEN 14 ELSE 0 END
      + CASE WHEN accepted_offer_count > 0 THEN 8 WHEN active_offer_count > 0 THEN 4 ELSE 0 END
    )) >= 60 THEN 'watch'
    WHEN LEAST(100, GREATEST(0,
      COALESCE(underwriting_score, funding_probability, 50)
      - LEAST(24, GREATEST(0, stage_age_days - stage_sla_days) * 6)
      - LEAST(18, missing_required_documents * 4)
      - LEAST(18, overdue_task_count * 6)
      - CASE WHEN compliance_blocker_count > 0 THEN 14 ELSE 0 END
      + CASE WHEN accepted_offer_count > 0 THEN 8 WHEN active_offer_count > 0 THEN 4 ELSE 0 END
    )) >= 40 THEN 'at_risk'
    ELSE 'blocked'
  END AS health_status,
  stage_age_days > stage_sla_days AS stage_sla_breached,
  CASE
    WHEN missing_required_documents > 0 THEN 'Request missing required documents'
    WHEN overdue_task_count > 0 THEN 'Clear overdue CRM tasks'
    WHEN compliance_blocker_count > 0 THEN 'Resolve compliance blocker'
    WHEN stage_age_days > stage_sla_days THEN 'Review stale stage and either advance, reassign, or close the file'
    WHEN offer_count = 0 AND stage_slug IN ('underwriting_review','submitted_to_partners') THEN 'Submit package or follow up with funders'
    WHEN offer_count > 0 AND accepted_offer_count = 0 THEN 'Present best offer and capture merchant decision'
    WHEN accepted_offer_count > 0 AND stage_slug NOT IN ('contract_signed','funded') THEN 'Send contract and collect final stips'
    WHEN stage_slug = 'funded' THEN 'Monitor paydown for renewal timing'
    ELSE 'Move to the next pipeline stage'
  END AS next_best_action
FROM deal_rollups;
