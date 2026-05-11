/*
  # Seed Demo Data - Phase 8

  ## Overview
  Inserts realistic demo businesses, owners, and deals for development/testing.
  All seed records use fixed UUIDs so this migration is idempotent.
*/

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_biz1 uuid := '11111111-0000-0000-0000-000000000001';
  v_biz2 uuid := '11111111-0000-0000-0000-000000000002';
  v_biz3 uuid := '11111111-0000-0000-0000-000000000003';
  v_biz4 uuid := '11111111-0000-0000-0000-000000000004';
  v_owner1 uuid := '22222222-0000-0000-0000-000000000001';
  v_owner2 uuid := '22222222-0000-0000-0000-000000000002';
  v_owner3 uuid := '22222222-0000-0000-0000-000000000003';
  v_owner4 uuid := '22222222-0000-0000-0000-000000000004';
  v_deal1 uuid := '33333333-0000-0000-0000-000000000001';
  v_deal2 uuid := '33333333-0000-0000-0000-000000000002';
  v_deal3 uuid := '33333333-0000-0000-0000-000000000003';
  v_deal4 uuid := '33333333-0000-0000-0000-000000000004';
BEGIN
  -- Businesses
  INSERT INTO businesses (id, organization_id, legal_name, dba, entity_type, industry, monthly_gross_revenue, average_daily_balance, deposit_count_monthly, start_date, phone, email, city, state, zip)
  VALUES
    (v_biz1, v_org_id, 'Metro Pizza Group LLC', 'Metro Pizza', 'llc', 'Restaurant', 85000, 12000, 18, '2019-03-15', '(212) 555-0101', 'owner@metropizza.com', 'New York', 'NY', '10001'),
    (v_biz2, v_org_id, 'Greenfield Auto Repair Inc', 'Greenfield Auto', 'c_corp', 'Automotive', 62000, 9500, 14, '2017-08-22', '(312) 555-0202', 'mgmt@greenfieldauto.com', 'Chicago', 'IL', '60601'),
    (v_biz3, v_org_id, 'Sunrise Medical Supplies LLC', null, 'llc', 'Healthcare', 142000, 28000, 22, '2015-01-10', '(310) 555-0303', 'billing@sunrisemed.com', 'Los Angeles', 'CA', '90001'),
    (v_biz4, v_org_id, 'Coastal Roofing & Construction', 'Coastal Roofing', 'llc', 'Construction', 97000, 15500, 16, '2018-06-01', '(904) 555-0404', 'ops@coastalroofing.com', 'Jacksonville', 'FL', '32099')
  ON CONFLICT (id) DO NOTHING;

  -- Owners
  INSERT INTO owners (id, organization_id, first_name, last_name, email, phone, ownership_percentage, credit_score_range, ssn_last4, city, state, zip)
  VALUES
    (v_owner1, v_org_id, 'Marcus', 'Rivera', 'marcus.rivera@email.com', '(917) 555-1001', 100, '650_699', '4821', 'New York', 'NY', '10001'),
    (v_owner2, v_org_id, 'Jennifer', 'Walsh', 'jennifer.walsh@email.com', '(773) 555-1002', 75, '700_749', '3967', 'Chicago', 'IL', '60601'),
    (v_owner3, v_org_id, 'David', 'Kim', 'david.kim@email.com', '(424) 555-1003', 60, '750_plus', '7234', 'Los Angeles', 'CA', '90001'),
    (v_owner4, v_org_id, 'Patricia', 'Nguyen', 'patricia.nguyen@email.com', '(904) 555-1004', 100, '700_749', '5519', 'Jacksonville', 'FL', '32099')
  ON CONFLICT (id) DO NOTHING;

  -- Business-Owner links
  INSERT INTO business_owners (organization_id, business_id, owner_id, ownership_percentage, is_primary)
  VALUES
    (v_org_id, v_biz1, v_owner1, 100, true),
    (v_org_id, v_biz2, v_owner2, 75, true),
    (v_org_id, v_biz3, v_owner3, 60, true),
    (v_org_id, v_biz4, v_owner4, 100, true)
  ON CONFLICT (business_id, owner_id) DO NOTHING;

  -- Deals
  INSERT INTO deals (id, organization_id, business_id, stage_slug, requested_amount, funding_probability, title)
  VALUES
    (v_deal1, v_org_id, v_biz1, 'underwriting_review', 75000, 65, 'Metro Pizza - $75K MCA'),
    (v_deal2, v_org_id, v_biz2, 'offers_received', 50000, 80, 'Greenfield Auto - $50K MCA'),
    (v_deal3, v_org_id, v_biz3, 'funded', 125000, 100, 'Sunrise Medical - $125K MCA'),
    (v_deal4, v_org_id, v_biz4, 'contract_sent', 95000, 75, 'Coastal Roofing - $95K MCA')
  ON CONFLICT (id) DO NOTHING;

  -- Update funded deal
  UPDATE deals
  SET funded_amount = 125000, funded_at = NOW() - INTERVAL '15 days'
  WHERE id = v_deal3 AND funded_amount IS NULL;

  -- Offers
  INSERT INTO offers (organization_id, deal_id, approved_amount, factor_rate, payback_amount, payment_frequency, daily_payment, status, net_funding_amount, term_days)
  VALUES
    (v_org_id, v_deal2, 50000, 1.35, 67500, 'daily', 675, 'received', 48500, 120),
    (v_org_id, v_deal2, 45000, 1.29, 58050, 'daily', 580.50, 'received', 43650, 110),
    (v_org_id, v_deal4, 95000, 1.38, 131100, 'daily', 874, 'presented', 92150, 150)
  ON CONFLICT DO NOTHING;

  -- Leads
  INSERT INTO leads (organization_id, lead_source, first_name, last_name, email, phone, business_name, status)
  VALUES
    (v_org_id, 'website', 'Robert', 'Thompson', 'rthompson@tfortruck.com', '(214) 555-2001', 'T-Force Trucking LLC', 'qualified'),
    (v_org_id, 'referral', 'Amanda', 'Foster', 'afoster@fostersalon.com', '(602) 555-2002', 'Foster Beauty Studio', 'contacted'),
    (v_org_id, 'paid_ads', 'Carlos', 'Mendez', 'carlos@mendezplumb.com', '(713) 555-2003', 'Mendez Plumbing & Heating', 'new'),
    (v_org_id, 'iso', 'Sandra', 'Lee', 'slee@leecatering.com', '(404) 555-2004', 'Lee Catering Services', 'application_started')
  ON CONFLICT DO NOTHING;

END;
$$;
