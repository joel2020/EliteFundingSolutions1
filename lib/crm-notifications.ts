import { createServiceSupabaseClient } from '@/lib/server-supabase';

export type CrmNotificationInput = {
  organizationId: string;
  actorUserProfileId?: string | null;
  // Optional specific recipient (e.g. the rep assigned to the deal). A broadcast
  // row (recipient null) is always written so admins/managers see it too.
  recipientUserProfileId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  title: string;
  body?: string | null;
  severity?: 'info' | 'success' | 'warning' | 'critical';
};

// Fire-and-forget: notification failures must never break the underlying workflow.
export async function createCrmNotification(input: CrmNotificationInput) {
  try {
    const supabase = createServiceSupabaseClient();
    const base = {
      organization_id: input.organizationId,
      actor_user_profile_id: input.actorUserProfileId || null,
      resource_type: input.resourceType,
      resource_id: input.resourceId || null,
      title: input.title,
      body: input.body || null,
      severity: input.severity || 'info',
    };
    const rows: Record<string, unknown>[] = [{ ...base, recipient_user_profile_id: null }];
    if (input.recipientUserProfileId && input.recipientUserProfileId !== input.actorUserProfileId) {
      rows.push({ ...base, recipient_user_profile_id: input.recipientUserProfileId });
    }
    await supabase.from('crm_notifications').insert(rows);
  } catch (error) {
    console.error('crm_notifications insert failed', error);
  }
}
