import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { syncOwnersFromApplicationPayload } from '@/lib/owner-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-time, token-guarded backfill that creates owners + business_owners records from
// existing partner application payloads. Runs with the service role + runtime encryption
// key so SSN/DOB are encrypted in the same format as the live app. Remove after running.
export async function POST(request: Request) {
  const token = request.headers.get('x-backfill-token') || '';
  const expected = process.env.BACKFILL_TOKEN || '';
  if (!expected || token !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();

  const [{ data: deals }, { data: applications }, { data: uploads }] = await Promise.all([
    supabase.from('deals').select('id,organization_id,business_id,application_id').is('deleted_at', null).limit(10000),
    supabase.from('applications').select('id,application_payload').is('deleted_at', null).limit(10000),
    supabase.from('partner_application_uploads').select('id,deal_id,edited_payload,extracted_payload,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(10000),
  ]);

  const appById = new Map((applications || []).map((a: any) => [a.id, a]));
  const latestUploadByDeal = new Map<string, any>();
  for (const upload of uploads || []) {
    if (!latestUploadByDeal.has(upload.deal_id)) latestUploadByDeal.set(upload.deal_id, upload);
  }

  const processedBusinesses = new Set<string>();
  let businessesProcessed = 0;
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const deal of deals || []) {
    if (!deal.business_id || processedBusinesses.has(deal.business_id)) continue;

    const app = deal.application_id ? appById.get(deal.application_id) : null;
    const appPayload = app?.application_payload || null;
    const upload = latestUploadByDeal.get(deal.id);
    const payload = (appPayload && (appPayload.owner1 || appPayload.owner2))
      ? appPayload
      : (upload?.edited_payload || upload?.extracted_payload || appPayload || null);

    if (!payload || (!payload.owner1 && !payload.owner2 && !payload.ein)) continue;

    processedBusinesses.add(deal.business_id);
    businessesProcessed += 1;
    try {
      const result = await syncOwnersFromApplicationPayload(supabase, {
        organizationId: deal.organization_id,
        businessId: deal.business_id,
        applicationId: deal.application_id,
        payload,
        actorProfileId: null,
      });
      created += result.created;
      updated += result.updated;
    } catch (error: any) {
      errors.push(`${deal.business_id}: ${error?.message || 'unknown error'}`);
    }
  }

  return NextResponse.json({
    success: true,
    totalDeals: (deals || []).length,
    businessesProcessed,
    ownersCreated: created,
    ownersUpdated: updated,
    errors,
  });
}
