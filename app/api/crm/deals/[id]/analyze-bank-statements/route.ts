import { NextResponse } from 'next/server';
import { analyzeBankStatementText, enrichBankStatementAnalysisWithAzureAI, extractStatementText } from '@/lib/bank-statement-analysis';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ANALYSIS_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

function isBankStatement(doc: any) {
  const type = String(doc.document_type || '').toLowerCase();
  const label = String(doc.label || doc.file_name || '').toLowerCase();
  return type.includes('bank_statement') || label.includes('bank statement') || label.includes('statement');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ANALYSIS_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: documents, error: documentError } = await supabase
    .from('documents')
    .select('id,file_name,label,document_type,mime_type,storage_path,status')
    .eq('organization_id', profile.organization_id)
    .or(`deal_id.eq.${deal.id},application_id.eq.${deal.application_id || '00000000-0000-0000-0000-000000000000'}`);

  if (documentError) return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });

  const statementDocs = (documents || []).filter((doc: any) => isBankStatement(doc) && doc.storage_path && doc.status !== 'rejected');
  if (!statementDocs.length) {
    await supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'system',
      title: 'AI bank statement analysis skipped',
      body: 'No bank statements are attached to this deal yet.',
      performed_by: profile.id,
    });
    return NextResponse.json({
      success: true,
      analysis: {
        analyzed: false,
        analysis_status: 'not_analyzed',
        reason: 'No bank statements are attached to this deal yet.',
        position_count: 0,
      },
    });
  }

  const texts: string[] = [];
  const extractionModes: string[] = [];

  for (const doc of statementDocs) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('application-documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ success: false, error: `Unable to read ${doc.file_name || 'bank statement'} for analysis.` }, { status: 500 });
    }

    const bytes = Buffer.from(await fileData.arrayBuffer());
    const extracted = await extractStatementText(bytes, doc.mime_type, doc.file_name);
    texts.push(extracted.text);
    extractionModes.push(`${doc.file_name || doc.id}: ${extracted.mode}`);
  }

  const analysis = await enrichBankStatementAnalysisWithAzureAI(texts, analyzeBankStatementText(texts));

  const { data: financial, error: financialError } = await supabase
    .from('deal_financials')
    .upsert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      total_deposits: analysis.total_deposits,
      total_withdrawals: analysis.total_withdrawals,
      net_cash_flow: analysis.net_cash_flow,
      average_daily_ledger_balance: analysis.average_daily_ledger_balance,
      negative_balance_days_per_month: analysis.negative_balance_days_per_month,
      nsf_count: analysis.nsf_count,
      analysis_status: 'completed',
      analysis_confidence: analysis.confidence,
      analysis_summary: analysis.ai_summary || analysis.extraction_notes,
      analyzed_at: new Date().toISOString(),
      analyzed_by: profile.id,
    }, { onConflict: 'organization_id,deal_id' })
    .select('id')
    .single();

  if (financialError) return NextResponse.json({ success: false, error: financialError.message }, { status: 500 });

  await supabase
    .from('current_positions')
    .delete()
    .eq('organization_id', profile.organization_id)
    .eq('deal_id', deal.id)
    .eq('source', 'ai_bank_analysis');

  if (analysis.detected_positions.length) {
    const { error: positionError } = await supabase.from('current_positions').insert(analysis.detected_positions.map((position) => ({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      business_id: deal.business_id,
      funder_name: position.funder_name,
      current_balance: null,
      daily_payment: position.payment_frequency === 'daily' ? position.payment_amount : null,
      weekly_payment: position.payment_frequency === 'weekly' ? position.payment_amount : null,
      payment_frequency: position.payment_frequency,
      status: 'active',
      source: 'ai_bank_analysis',
      recurrence_pattern: position.payment_frequency,
      occurrences: position.occurrences,
      confidence: position.confidence,
      first_seen: position.first_seen,
      last_seen: position.last_seen,
      notes: 'Auto-detected from bank statement recurring debits.',
    })));
    if (positionError) return NextResponse.json({ success: false, error: positionError.message }, { status: 500 });
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from('bank_statement_analyses')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      business_id: deal.business_id,
      application_id: deal.application_id,
      status: 'completed',
      total_deposits: analysis.total_deposits,
      total_withdrawals: analysis.total_withdrawals,
      net_cash_flow: analysis.net_cash_flow,
      average_daily_ledger_balance: analysis.average_daily_ledger_balance,
      negative_balance_days_per_month: analysis.negative_balance_days_per_month,
      nsf_count: analysis.nsf_count,
      position_count: analysis.position_count,
      detected_positions: analysis.detected_positions,
      source_document_ids: statementDocs.map((doc: any) => doc.id),
      extraction_notes: `${analysis.extraction_notes} Extraction modes: ${extractionModes.join('; ')}`,
      confidence: analysis.confidence,
      raw_metrics: {
        transactionsParsed: analysis.transactions.length,
        financial_id: financial.id,
        ai_provider: analysis.ai_provider || null,
        ai_summary: analysis.ai_summary || null,
        ai_risk_flags: analysis.ai_risk_flags || [],
        ai_underwriting_notes: analysis.ai_underwriting_notes || [],
        ai_lender_match_notes: analysis.ai_lender_match_notes || [],
      },
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (analysisError) return NextResponse.json({ success: false, error: analysisError.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'ai_analysis',
      title: 'AI bank statement analysis completed',
      body: `${analysis.position_count} position(s), ${analysis.nsf_count} NSF item(s), net cash flow $${analysis.net_cash_flow.toLocaleString()}.`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'bank_statement_analysis_completed',
      resource_type: 'bank_statement_analyses',
      resource_id: analysisRow.id,
      new_data: {
        deal_id: deal.id,
        source_document_ids: statementDocs.map((doc: any) => doc.id),
        position_count: analysis.position_count,
        confidence: analysis.confidence,
      },
    }),
  ]);

  return NextResponse.json({ success: true, analysisId: analysisRow.id, analysis });
}
