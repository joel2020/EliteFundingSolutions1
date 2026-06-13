import { digitsOnly, encryptSensitiveField } from '@/lib/security';

type RecordMap = Record<string, any>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function parsePercent(value: unknown): number | null {
  const numeric = parseFloat(text(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function splitName(full: string) {
  const parts = full.split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

/**
 * Pull the owner blocks out of a normalized partner-application payload
 * (the shape produced by buildPartnerApplicationPayload: owner1 / owner2).
 */
export function ownersFromApplicationPayload(payload: RecordMap | null | undefined): RecordMap[] {
  if (!payload) return [];
  return ['owner1', 'owner2']
    .map((key) => payload[key])
    .filter((owner: RecordMap) => owner && (text(owner.first_name) || text(owner.last_name) || text(owner.full_name)));
}

/**
 * Create or update owner + business_owner records from an uploaded/reviewed partner
 * application payload so the CRM "Owner info" reflects what was on the application.
 * Idempotent: re-running matches existing owners for the business by name/email and updates
 * them instead of duplicating. Also backfills the business EIN when it is not yet stored.
 */
export async function syncOwnersFromApplicationPayload(
  supabase: any,
  args: {
    organizationId: string;
    businessId?: string | null;
    applicationId?: string | null;
    payload: RecordMap | null | undefined;
    actorProfileId?: string | null;
  },
): Promise<{ created: number; updated: number }> {
  const { organizationId, businessId, applicationId, payload, actorProfileId } = args;
  if (!businessId || !payload) return { created: 0, updated: 0 };

  const payloadOwners = ownersFromApplicationPayload(payload);

  // Backfill the business EIN when the application carries one and the business has none yet.
  const payloadEin = digitsOnly(payload.ein);
  if (payloadEin) {
    const { data: business } = await supabase
      .from('businesses')
      .select('id,ein_encrypted')
      .eq('id', businessId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (business && !business.ein_encrypted) {
      await supabase
        .from('businesses')
        .update({ ein_encrypted: encryptSensitiveField(payloadEin), ein_last4: payloadEin.slice(-4) })
        .eq('id', businessId)
        .eq('organization_id', organizationId);
    }
  }

  if (!payloadOwners.length) return { created: 0, updated: 0 };

  const { data: links } = await supabase
    .from('business_owners')
    .select('id,is_primary,owner_id,owners(id,first_name,last_name,full_name,email)')
    .eq('organization_id', organizationId)
    .eq('business_id', businessId);
  const existing = (links || []).map((link: RecordMap) => ({ link, owner: link.owners }));
  const claimed = new Set<string>();

  let created = 0;
  let updated = 0;

  for (let index = 0; index < payloadOwners.length; index += 1) {
    const owner = payloadOwners[index];
    const first = text(owner.first_name) || splitName(text(owner.full_name)).first;
    const last = text(owner.last_name) || splitName(text(owner.full_name)).last;
    const full = text(owner.full_name) || [first, last].filter(Boolean).join(' ');
    const email = text(owner.email).toLowerCase();
    const ownershipPercentage = parsePercent(owner.ownership_percentage);

    const match = existing.find((entry: RecordMap) => {
      if (!entry.owner?.id || claimed.has(entry.owner.id)) return false;
      const existingEmail = text(entry.owner?.email).toLowerCase();
      const existingFull = (text(entry.owner?.full_name) || `${text(entry.owner?.first_name)} ${text(entry.owner?.last_name)}`).trim().toLowerCase();
      return (email && existingEmail && email === existingEmail) || (full && existingFull && full.toLowerCase() === existingFull);
    });

    const ssnDigits = digitsOnly(owner.ssn);
    const dob = text(owner.dob);
    const ownerRecord: RecordMap = {
      organization_id: organizationId,
      first_name: first || full || 'Owner',
      last_name: last,
      full_name: full || null,
      email: text(owner.email) || null,
      phone: text(owner.phone || owner.mobile) || null,
      address: text(owner.address || owner.home_address) || null,
      home_address: text(owner.home_address || owner.address) || null,
      city: text(owner.city) || null,
      state: text(owner.state) || null,
      zip: text(owner.zip) || null,
      ownership_percentage: ownershipPercentage,
      ...(applicationId ? { application_id: applicationId } : {}),
      updated_by: actorProfileId || null,
    };
    if (ssnDigits) {
      ownerRecord.ssn_encrypted = encryptSensitiveField(ssnDigits);
      ownerRecord.ssn_last4 = ssnDigits.slice(-4);
      ownerRecord.ssn_last_four = ssnDigits.slice(-4);
    }
    if (dob) {
      ownerRecord.dob_encrypted = encryptSensitiveField(dob);
    }

    if (match) {
      claimed.add(match.owner.id);
      await supabase.from('owners').update(ownerRecord).eq('id', match.owner.id).eq('organization_id', organizationId);
      await supabase
        .from('business_owners')
        .update({ ownership_percentage: ownershipPercentage, is_primary: index === 0 })
        .eq('id', match.link.id)
        .eq('organization_id', organizationId);
      updated += 1;
    } else {
      const { data: createdOwner, error: ownerError } = await supabase
        .from('owners')
        .insert({ ...ownerRecord, created_by: actorProfileId || null })
        .select('id')
        .single();
      if (ownerError || !createdOwner) continue;
      const { error: linkError } = await supabase.from('business_owners').insert({
        organization_id: organizationId,
        business_id: businessId,
        owner_id: createdOwner.id,
        ownership_percentage: ownershipPercentage,
        is_primary: index === 0,
      });
      if (!linkError) created += 1;
    }
  }

  return { created, updated };
}
