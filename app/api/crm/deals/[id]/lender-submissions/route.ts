import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SEND_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];
const MAX_RESEND_ATTACHMENT_BYTES = 35 * 1024 * 1024;

const submissionSchema = z.object({
  funding_partner_id: z.string().uuid(),
  custom_message: z.string().trim().min(1, 'A lender message is required.'),
  attachment_document_ids: z.array(z.string().uuid()).default([]),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(SEND_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = submissionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid lender submission.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount,approved_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: partner } = await supabase
    .from('funding_partners')
    .select('id,name,email,submission_email,portal_url')
    .eq('id', parsed.data.funding_partner_id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!partner) return NextResponse.json({ success: false, error: 'Funding partner not found.' }, { status: 404 });

  const documentIds = parsed.data.attachment_document_ids;
  const { data: documents, error: docError } = documentIds.length
    ? await supabase
      .from('documents')
      .select('id,file_name,document_type,label,status,deal_id,application_id,storage_path,mime_type,file_size')
      .eq('organization_id', profile.organization_id)
      .in('id', documentIds)
    : { data: [], error: null };

  if (docError) return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
  if ((documents || []).length !== documentIds.length) return NextResponse.json({ success: false, error: 'One or more selected documents could not be found.' }, { status: 400 });

  const invalidDocument = (documents || []).find((doc: any) => doc.deal_id !== deal.id && doc.application_id !== deal.application_id);
  if (invalidDocument) return NextResponse.json({ success: false, error: 'Selected attachments must belong to this deal.' }, { status: 400 });

  const { data: priorDefaults } = await supabase
    .from('deal_risk_events')
    .select('id,deal_id,event_date,amount,notes')
    .eq('organization_id', profile.organization_id)
    .eq('business_id', deal.business_id)
    .eq('funding_partner_id', partner.id)
    .eq('event_type', 'defaulted')
    .limit(10);

  const emailSubject = `${deal.title || 'Funding package'} - lender review`;
  const selectedAttachmentLine = (documents || []).map((doc: any) => doc.file_name).join(', ') || 'None selected';
  const generatedEmailBody = [
    parsed.data.custom_message,
    '',
    `Requested amount: $${Number(deal.requested_amount || deal.approved_amount || 0).toLocaleString()}`,
    `Selected attachments: ${selectedAttachmentLine}`,
    priorDefaults?.length ? `Risk warning: prior default history exists with ${partner.name}. Review before proceeding.` : '',
  ].filter(Boolean).join('\n');

  const { data: submission, error: submissionError } = await supabase
    .from('partner_submissions')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      funding_partner_id: partner.id,
      submitted_by: profile.id,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
      notes: parsed.data.custom_message,
      custom_message: parsed.data.custom_message,
      attachment_document_ids: documentIds,
      email_subject: emailSubject,
      generated_email_body: generatedEmailBody,
    })
    .select('id')
    .single();

  if (submissionError) return NextResponse.json({ success: false, error: submissionError.message }, { status: 500 });

  if (documentIds.length) {
    const { error: attachmentError } = await supabase.from('lender_submission_attachments').insert(documentIds.map((documentId) => ({
      organization_id: profile.organization_id,
      partner_submission_id: submission.id,
      document_id: documentId,
    })));
    if (attachmentError) return NextResponse.json({ success: false, error: attachmentError.message }, { status: 500 });
  }

  const recipientEmail = partner.submission_email || partner.email || '';
  const totalAttachmentBytes = (documents || []).reduce((total: number, doc: any) => total + Number(doc.file_size || 0), 0);
  const canAttachFiles = totalAttachmentBytes > 0 && totalAttachmentBytes <= MAX_RESEND_ATTACHMENT_BYTES;
  const providerAttachments: { filename?: string | false; content?: Buffer; contentType?: string }[] = [];
  const signedLinks: { fileName: string; signedUrl: string }[] = [];
  const attachmentWarnings: string[] = [];

  if (recipientEmail && documentIds.length) {
    for (const doc of documents || []) {
      if (!doc.storage_path) {
        attachmentWarnings.push(`${doc.file_name} has no storage path.`);
        continue;
      }

      if (canAttachFiles) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('application-documents')
          .download(doc.storage_path);

        if (downloadError || !fileData) {
          attachmentWarnings.push(`Could not attach ${doc.file_name}; generating a secure link instead.`);
        } else {
          const arrayBuffer = await fileData.arrayBuffer();
          providerAttachments.push({
            filename: doc.file_name,
            content: Buffer.from(arrayBuffer),
            contentType: doc.mime_type || 'application/octet-stream',
          });
          continue;
        }
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('application-documents')
        .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7, { download: doc.file_name });

      if (signedUrlError || !signedUrlData?.signedUrl) {
        attachmentWarnings.push(`Could not create a secure link for ${doc.file_name}.`);
      } else {
        signedLinks.push({ fileName: doc.file_name, signedUrl: signedUrlData.signedUrl });
      }
    }
  }

  if (recipientEmail && totalAttachmentBytes > MAX_RESEND_ATTACHMENT_BYTES) {
    attachmentWarnings.push('Selected documents exceed the direct attachment limit, so secure download links were included instead.');
  }

  const signedLinkText = signedLinks.length
    ? `\n\nSecure document links:\n${signedLinks.map((link) => `${link.fileName}: ${link.signedUrl}`).join('\n')}`
    : '';
  const riskWarningText = priorDefaults?.length ? `\n\nRisk warning: prior default history exists with ${partner.name}. Review before proceeding.` : '';
  const emailText = `${parsed.data.custom_message}\n\nRequested amount: $${Number(deal.requested_amount || deal.approved_amount || 0).toLocaleString()}\nSelected attachments: ${selectedAttachmentLine}${signedLinkText}${riskWarningText}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>${textToHtml(parsed.data.custom_message)}</p>
      <p><strong>Requested amount:</strong> $${Number(deal.requested_amount || deal.approved_amount || 0).toLocaleString()}</p>
      <p><strong>Selected attachments:</strong> ${escapeHtml(selectedAttachmentLine)}</p>
      ${signedLinks.length ? `<p><strong>Secure document links:</strong></p><ul>${signedLinks.map((link) => `<li><a href="${escapeHtml(link.signedUrl)}">${escapeHtml(link.fileName)}</a></li>`).join('')}</ul>` : ''}
      ${priorDefaults?.length ? `<p style="color: #991b1b;"><strong>Risk warning:</strong> prior default history exists with ${escapeHtml(partner.name)}. Review before proceeding.</p>` : ''}
    </div>
  `;

  let emailDeliveryStatus = recipientEmail ? 'drafted' : 'missing_recipient';
  let emailProviderData: unknown = null;
  let emailProviderError: string | null = null;

  if (recipientEmail) {
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      attachments: providerAttachments,
    });

    if (emailResult.success) {
      emailDeliveryStatus = 'sent';
      emailProviderData = emailResult.data;
    } else {
      emailDeliveryStatus = 'failed';
      emailProviderError = emailResult.error || 'Unable to send lender email.';
    }
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'partner_submission',
      title: `Submitted to lender: ${partner.name}`,
      body: generatedEmailBody,
      performed_by: profile.id,
    }),
    supabase.from('messages').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      direction: 'outbound',
      channel: 'email',
      sender_user_id: profile.id,
      recipient_email: recipientEmail || null,
      subject: emailSubject,
      body: emailText,
      delivery_status: emailDeliveryStatus === 'sent' ? 'sent' : emailDeliveryStatus === 'failed' ? 'failed' : 'pending',
      sent_at: emailDeliveryStatus === 'sent' ? new Date().toISOString() : null,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'lender_submission_created',
      resource_type: 'partner_submissions',
      resource_id: submission.id,
      new_data: {
        deal_id: deal.id,
        funding_partner_id: partner.id,
        attachment_document_ids: documentIds,
        prior_default_count: priorDefaults?.length || 0,
        email_delivery_status: emailDeliveryStatus,
        email_provider_data: emailProviderData,
        email_provider_error: emailProviderError,
        attachment_warnings: attachmentWarnings,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    submissionId: submission.id,
    emailDeliveryStatus,
    emailProviderError,
    warnings: [
      ...(priorDefaults?.length ? [`Prior default history exists with ${partner.name}.`] : []),
      ...attachmentWarnings,
      ...(emailProviderError ? [`Email was recorded but not sent: ${emailProviderError}`] : []),
    ],
    emailDraft: {
      to: recipientEmail,
      subject: emailSubject,
      body: emailText,
      attachmentDocumentIds: documentIds,
    },
  });
}
