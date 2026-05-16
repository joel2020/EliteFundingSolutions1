import type { Page, Route } from '@playwright/test';

export const ORG_ID = '00000000-0000-0000-0000-000000000001';
export const ADMIN_PROFILE_ID = '11111111-1111-1111-1111-111111111111';
export const SALES_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
export const DEAL_ID = '33333333-3333-3333-3333-333333333333';
export const LEAD_ID = '44444444-4444-4444-4444-444444444444';
export const DOC_ID = '55555555-5555-5555-5555-555555555555';
export const BUSINESS_ID = '66666666-6666-6666-6666-666666666666';
export const OFFER_ID = '77777777-7777-7777-7777-777777777777';

export type MockRole = 'super_admin' | 'admin' | 'manager' | 'sales_rep' | 'processor' | 'underwriter' | 'client';

type MockState = Record<string, any[]>;

const now = '2026-05-14T12:00:00.000Z';

export function createCrmState(role: MockRole = 'admin'): MockState {
  const activeProfile = {
    id: ADMIN_PROFILE_ID,
    user_id: 'auth-user-1',
    organization_id: ORG_ID,
    email: 'admin@elitefunding.test',
    first_name: role === 'sales_rep' ? 'Sam' : 'Avery',
    last_name: role === 'sales_rep' ? 'Rep' : 'Admin',
    role,
    is_active: true,
    last_login_at: now,
  };

  return {
    leads: [
      {
        id: LEAD_ID,
        organization_id: ORG_ID,
        business_name: 'Harbor Bistro',
        first_name: 'Mia',
        last_name: 'Stone',
        phone: '2125550198',
        email: 'mia@harbor.test',
        lead_source: 'manual_entry',
        status: 'new',
        requested_amount: 60000,
        assigned_user_id: ADMIN_PROFILE_ID,
        created_at: now,
      },
    ],
    deals: [
      {
        id: DEAL_ID,
        organization_id: ORG_ID,
        business_id: BUSINESS_ID,
        title: 'Atlas Retail - $75K MCA',
        stage_slug: 'offers_received',
        requested_amount: 75000,
        approved_amount: 70000,
        funded_amount: 0,
        funding_probability: 80,
        assigned_user_id: ADMIN_PROFILE_ID,
        created_at: now,
        updated_at: now,
      },
    ],
    offers: [
      {
        id: OFFER_ID,
        organization_id: ORG_ID,
        deal_id: DEAL_ID,
        funding_partner_id: '88888888-8888-8888-8888-888888888888',
        approved_amount: 70000,
        factor_rate: 1.34,
        payback_amount: 93800,
        term_days: 120,
        daily_payment: 781,
        status: 'presented',
        created_at: now,
      },
    ],
    renewals: [
      {
        id: '99999999-9999-9999-9999-999999999999',
        organization_id: ORG_ID,
        original_deal_id: DEAL_ID,
        business_id: BUSINESS_ID,
        original_funded_amount: 70000,
        current_balance: 31500,
        percent_paid_down: 55,
        renewal_probability: 72,
        renewal_date: '2026-05-14',
        status: 'eligible_soon',
        alert_flags: ['Paydown watch'],
        notes: 'Review latest deposits before outreach.',
        updated_at: now,
      },
    ],
    commissions: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        organization_id: ORG_ID,
        deal_id: DEAL_ID,
        offer_id: OFFER_ID,
        rep_id: ADMIN_PROFILE_ID,
        funded_amount: 70000,
        commission_pct: 8,
        commission_amount: 5600,
        payment_status: 'pending',
        created_at: now,
      },
    ],
    funding_partners: [
      {
        id: '88888888-8888-8888-8888-888888888888',
        organization_id: ORG_ID,
        name: 'Apex Business Funding',
        created_at: now,
      },
    ],
    user_profiles: [
      { ...activeProfile, referral_slug: role === 'sales_rep' ? 'sam-rep-auth-us' : 'avery-admin-auth-us' },
      {
        id: SALES_PROFILE_ID,
        user_id: 'auth-user-2',
        organization_id: ORG_ID,
        email: 'rep@elitefunding.test',
        first_name: 'Riley',
        last_name: 'Rep',
        role: 'sales_rep',
        is_active: true,
        last_login_at: now,
        referral_slug: 'riley-rep-auth-us',
      },
    ],
    businesses: [
      {
        id: BUSINESS_ID,
        organization_id: ORG_ID,
        legal_name: 'Atlas Retail LLC',
        dba: 'Atlas Retail',
        contact_name: 'Jordan Lee',
        industry: 'Retail',
        phone: '2125550123',
        email: 'ops@atlas.test',
        monthly_gross_revenue: 125000,
        city: 'New York',
        state: 'NY',
        created_at: now,
      },
    ],
    activities: [{ id: 'activity-1', organization_id: ORG_ID, deal_id: DEAL_ID, activity_type: 'offer', title: 'Offer presented', body: 'Merchant is reviewing terms.', created_at: now }],
    documents: [
      {
        id: DOC_ID,
        organization_id: ORG_ID,
        deal_id: DEAL_ID,
        document_type: 'bank_statement',
        label: 'Bank Statement',
        file_name: 'atlas-bank-statements.pdf',
        file_size: 128000,
        mime_type: 'application/pdf',
        storage_path: `${ORG_ID}/atlas-bank-statements.pdf`,
        status: 'uploaded',
        review_notes: 'March through May statements.',
        created_at: now,
      },
    ],
    notes: [{ id: 'note-1', organization_id: ORG_ID, deal_id: DEAL_ID, body: 'Merchant is reviewing offer.', is_internal: true, created_at: now }],
    partner_submissions: [{ id: 'submission-1', organization_id: ORG_ID, deal_id: DEAL_ID, funding_partner_id: '88888888-8888-8888-8888-888888888888', submitted_by: ADMIN_PROFILE_ID, submitted_at: now, status: 'in_review', notes: 'Submitted via portal.', created_at: now, updated_at: now }],
    document_requests: [{ id: 'request-1', organization_id: ORG_ID, deal_id: DEAL_ID, document_type: 'voided_check', label: 'Voided check', status: 'requested', category: 'submission', required: true, due_date: '2026-05-20', notes: 'Needed before submission.', created_at: now, updated_at: now }],
    tasks: [{ id: 'task-1', organization_id: ORG_ID, deal_id: DEAL_ID, title: 'Follow up with Apex', priority: 'high', status: 'open', due_date: '2026-05-16T12:00:00.000Z', assigned_user_id: ADMIN_PROFILE_ID, created_at: now, updated_at: now }],
    stipulations: [{ id: 'stip-1', organization_id: ORG_ID, deal_id: DEAL_ID, offer_id: OFFER_ID, name: 'Final bank verification', status: 'requested', due_date: '2026-05-20', assigned_user_id: ADMIN_PROFILE_ID, created_at: now, updated_at: now }],
    owners: [{ id: 'owner-1', organization_id: ORG_ID, first_name: 'Jordan', last_name: 'Lee', phone: '2125550100', ssn_last4: '1234', created_at: now, updated_at: now }],
    current_positions: [{ id: 'position-1', organization_id: ORG_ID, deal_id: DEAL_ID, funder_name: 'Old Advance Co', original_funded_amount: 30000, current_balance: 9000, daily_payment: 250, status: 'active' }],
    deal_financials: [{ id: 'financial-1', organization_id: ORG_ID, deal_id: DEAL_ID, current_balance: 31500, percent_paid_down: 55, total_payback: 93800, daily_payment: 781, remaining_term_days: 42 }],
    applications: [],
    status_history: [],
  };
}

export async function mockCrmApis(page: Page, role: MockRole = 'admin') {
  const state = createCrmState(role);
  const calls: Array<{ method: string; table: string; body: any }> = [];

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'sb-mdrrcrmowurbrwvdsgnq-auth-token',
      JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'auth-user-1', email: 'admin@elitefunding.test' },
      })
    );
  });

  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'auth-user-1', email: 'admin@elitefunding.test' },
      }),
    });
  });

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'auth-user-1', email: 'admin@elitefunding.test' } }) });
  });

  await page.route('**/auth/v1/logout**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/storage/v1/object/application-documents/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'mock-uploaded-file' }) });
  });

  await page.route('**/api/applications/submit', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, applicationId: 'app-1' }) });
  });

  await page.route('**/api/documents/*/signed-url', async (route) => {
    calls.push({ method: route.request().method(), table: 'document_signed_url', body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, url: 'https://signed.example/atlas-bank-statements.pdf' }) });
  });

  await page.route('**/api/crm/deals', async (route) => {
    const payload = route.request().postDataJSON() as any;
    const businessTitle = payload.title || payload.business_name || 'New deal';
    const businessId = `business-${state.businesses.length + 1}`;
    state.businesses.unshift({
      id: businessId,
      organization_id: ORG_ID,
      legal_name: businessTitle,
      dba: businessTitle,
      contact_name: payload.contact_name || null,
      created_at: now,
      updated_at: now,
    });
    const deal = {
      id: `deal-${state.deals.length + 1}`,
      organization_id: ORG_ID,
      business_id: businessId,
      title: businessTitle,
      requested_amount: payload.requested_amount || null,
      approved_amount: payload.approved_amount || null,
      stage_slug: payload.stage_slug || 'lead_captured',
      assigned_user_id: payload.assigned_user_id || ADMIN_PROFILE_ID,
      created_at: now,
      updated_at: now,
    };
    state.deals.unshift(deal);
    calls.push({ method: route.request().method(), table: 'deals', body: payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, deal }) });
  });

  await page.route('**/api/crm/deals/*/stage', async (route) => {
    const payload = route.request().postDataJSON() as any;
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    state.deals = state.deals.map((deal) => deal.id === id ? { ...deal, stage_slug: payload.stage_slug, updated_at: now } : deal);
    calls.push({ method: route.request().method(), table: 'deal_stage', body: payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/crm/users', async (route) => {
    const payload = route.request().postDataJSON() as any;
    const id = `user-${state.user_profiles.length + 1}`;
    const slugBase = [payload.first_name, payload.last_name].filter(Boolean).join('-') || payload.email.split('@')[0];
    const user = {
      id,
      user_id: `auth-${id}`,
      organization_id: ORG_ID,
      email: payload.email,
      first_name: payload.first_name || '',
      last_name: payload.last_name || '',
      role: payload.role || 'sales_rep',
      is_active: payload.is_active !== false,
      referral_slug: `${slugBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${id}`,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    state.user_profiles.unshift(user);
    calls.push({ method: route.request().method(), table: 'user_profiles', body: payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user }) });
  });

  await page.route('**/api/crm/users/*', async (route) => {
    const payload = route.request().postDataJSON() as any;
    const id = new URL(route.request().url()).pathname.split('/').pop();
    state.user_profiles = state.user_profiles.map((user) => user.id === id ? { ...user, ...payload, updated_at: now } : user);
    const user = state.user_profiles.find((item) => item.id === id);
    calls.push({ method: route.request().method(), table: 'user_profiles', body: payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user }) });
  });

  await page.route('**/api/crm/applications/*/status', async (route) => {
    const payload = route.request().postDataJSON() as any;
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    state.applications = state.applications.map((app) => app.id === id ? { ...app, status: payload.status, updated_at: now } : app);
    calls.push({ method: route.request().method(), table: 'application_status', body: payload });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.context().route('https://signed.example/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 signed document' });
  });

  await page.route('**/rest/v1/**', async (route) => handleRestRoute(route, state, calls));

  return { state, calls };
}

async function handleRestRoute(route: Route, state: MockState, calls: Array<{ method: string; table: string; body: any }>) {
  const request = route.request();
  const url = new URL(request.url());
  const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] || '';
  const method = request.method();

  if (!(table in state)) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    return;
  }

  if (method === 'GET') {
    const rows = filterRows(table, state[table], url);
    if (table === 'user_profiles' && url.searchParams.has('user_id')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0] || null) });
      return;
    }
    const wantsObject = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? rows[0] || null : rows) });
    return;
  }

  if (method === 'POST') {
    const payload = request.postDataJSON() as any;
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted = rows.map((row) => ({ id: row.id || `${table}-${state[table].length + 1}`, created_at: now, updated_at: now, ...row }));
    state[table].unshift(...inserted);
    calls.push({ method, table, body: payload });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(inserted) });
    return;
  }

  if (method === 'PATCH') {
    const payload = request.postDataJSON() as any;
    const id = url.searchParams.get('id')?.replace('eq.', '');
    state[table] = state[table].map((row) => (id && row.id === id ? { ...row, ...payload, updated_at: now } : row));
    calls.push({ method, table, body: payload });
    await route.fulfill({ status: 204, body: '' });
    return;
  }

  if (method === 'DELETE') {
    calls.push({ method, table, body: null });
    await route.fulfill({ status: 204, body: '' });
    return;
  }

  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
}

function filterRows(table: string, rows: any[], url: URL) {
  let filtered = [...rows];
  url.searchParams.forEach((value, key) => {
    if (value.startsWith('eq.')) {
      const field = key.split('.')[0];
      const expected = value.replace('eq.', '');
      filtered = filtered.filter((row) => String(row[field]) === expected);
    }
  });
  if (table === 'leads' || table === 'deals' || table === 'applications') {
    filtered = filtered.filter((row) => !row.deleted_at);
  }
  return filtered;
}
