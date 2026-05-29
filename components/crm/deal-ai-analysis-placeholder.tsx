'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';

type RecordMap = Record<string, any>;

type LoadState = {
  deal: RecordMap | null;
  application: RecordMap | null;
  documents: RecordMap[];
  notes: RecordMap[];
  riskEvents: RecordMap[];
  submissions: RecordMap[];
};

const REQUIRED_DOCUMENTS = [
  { key: 'completed_application', label: 'Completed signed application' },
  { key: 'bank_statements', label: 'Bank statements' },
  { key: 'drivers_license', label: "Driver's license" },
  { key: 'tax_documents', label: 'Tax documents' },
];

function normalize(value?: string | null) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function documentMatches(documentType: string | null | undefined, requiredType: string) {
  const type = normalize(documentType);
  if (requiredType === 'completed_application') return ['completedapplication', 'signedapplication', 'application'].includes(type);
  if (requiredType === 'bank_statements') return ['bankstatement', 'bankstatements', 'mtdbankstatement', 'monthtodatebankstatement'].includes(type);
  if (requiredType === 'drivers_license') return ['driverslicense', 'driverlicense', 'licenseverification'].includes(type);
  if (requiredType === 'tax_documents') return ['taxdocument', 'taxdocuments', 'taxreturn', 'taxreturns'].includes(type);
  return type === normalize(requiredType);
}

function hasRequiredDocument(documents: RecordMap[], requiredType: string) {
  return documents.some((document) => document.status !== 'rejected' && documentMatches(document.document_type, requiredType));
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function noteBody(note: RecordMap) {
  return note.body || note.note || note.content || note.notes || '';
}

function riskLabel(event: RecordMap) {
  return event.title || event.event_type || event.risk_type || event.notes || 'Risk event recorded';
}

export function DealAiAnalysisPlaceholder({ dealId }: { dealId: string }) {
  const { organizationId, loading: userLoading } = useCrmUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    deal: null,
    application: null,
    documents: [],
    notes: [],
    riskEvents: [],
    submissions: [],
  });

  useEffect(() => {
    if (userLoading) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .maybeSingle();

      if (!active) return;
      if (dealError || !deal) {
        setError(dealError?.message || 'Deal not found.');
        setLoading(false);
        return;
      }

      const org = organizationId || deal.organization_id;
      const applicationQuery = deal.application_id
        ? supabase.from('applications').select('*').eq('id', deal.application_id).maybeSingle()
        : deal.business_id
          ? supabase.from('applications').select('*').eq('business_id', deal.business_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null });

      const [applicationResult, dealDocsResult, notesResult, riskEventsResult, submissionsResult] = await Promise.all([
        applicationQuery,
        supabase.from('documents').select('*').eq('organization_id', org).eq('deal_id', dealId).order('created_at', { ascending: false }),
        supabase.from('notes').select('*').eq('organization_id', org).eq('deal_id', dealId).order('created_at', { ascending: false }).limit(10),
        supabase.from('deal_risk_events').select('*').eq('organization_id', org).eq('deal_id', dealId).order('created_at', { ascending: false }).limit(10),
        supabase.from('partner_submissions').select('*').eq('organization_id', org).eq('deal_id', dealId).order('created_at', { ascending: false }).limit(20),
      ]);

      const application = (applicationResult as any).data || null;
      let applicationDocuments: RecordMap[] = [];
      if (application?.id) {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .eq('organization_id', org)
          .eq('application_id', application.id)
          .order('created_at', { ascending: false });
        applicationDocuments = data || [];
      }

      if (!active) return;
      setState({
        deal,
        application,
        documents: [...(dealDocsResult.data || []), ...applicationDocuments],
        notes: notesResult.data || [],
        riskEvents: riskEventsResult.data || [],
        submissions: submissionsResult.data || [],
      });
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, [dealId, organizationId, userLoading]);

  const analysis = useMemo(() => {
    const missingDocuments = REQUIRED_DOCUMENTS.filter((item) => !hasRequiredDocument(state.documents, item.key));
    const fileCompletenessScore = REQUIRED_DOCUMENTS.length
      ? ((REQUIRED_DOCUMENTS.length - missingDocuments.length) / REQUIRED_DOCUMENTS.length) * 100
      : 0;
    const signedApplication = state.application?.signature_status === 'signed' || hasRequiredDocument(state.documents, 'completed_application');
    const hasLenderSubmissions = state.submissions.length > 0;
    const hasSeriousRisk = state.riskEvents.some((event) => ['high', 'critical', 'default', 'fraud'].some((term) => normalize(event.severity || event.event_type || event.risk_type).includes(term)));
    const nsfCount = Number(state.application?.nsf_count || 0);
    const negativeDays = Number(state.application?.negative_days_count || 0);
    const redFlags = [
      ...state.riskEvents.slice(0, 3).map(riskLabel),
      nsfCount > 0 ? `${nsfCount} NSF item${nsfCount === 1 ? '' : 's'} recorded` : '',
      negativeDays > 0 ? `${negativeDays} negative day${negativeDays === 1 ? '' : 's'} recorded` : '',
      missingDocuments.length ? `${missingDocuments.length} required file item${missingDocuments.length === 1 ? '' : 's'} missing` : '',
    ].filter(Boolean);
    const fundingReadinessScore = fileCompletenessScore * 0.65
      + (signedApplication ? 15 : 0)
      + (hasLenderSubmissions ? 10 : 0)
      - (hasSeriousRisk ? 15 : 0)
      - (nsfCount > 3 ? 5 : 0)
      - (negativeDays > 3 ? 5 : 0);
    const latestInternalNote = state.notes.map(noteBody).find(Boolean);

    return {
      missingDocuments,
      fileCompletenessScore,
      fundingReadinessScore,
      redFlags,
      latestInternalNote,
      suggestedNextSteps: missingDocuments.length
        ? `Collect ${missingDocuments.map((item) => item.label.toLowerCase()).join(', ')} before packaging.`
        : hasLenderSubmissions
          ? 'Review lender responses and update offer or follow-up status.'
          : 'File appears package-ready from current CRM records. Select funders and send the package.',
      riskSummary: redFlags.length
        ? 'CRM records show items that should be reviewed by staff before lender submission.'
        : 'No red flags are recorded in the current CRM fields reviewed by this placeholder.',
    };
  }, [state]);

  return (
    <section className="shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 lg:px-6" aria-label="AI analysis placeholder">
      <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0F2B5B]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">AI Analysis</h2>
              <span className="rounded-[6px] border border-[#F59E0B33] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">AI analysis not connected yet</span>
            </div>
            <p className="mt-1 text-sm text-[#475569]">This panel uses live CRM records for placeholder readiness signals only. It does not call an AI provider or create an automated underwriting decision.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs sm:flex sm:text-left">
            <div className="rounded-[7px] bg-[#F1F5F9] px-3 py-2">
              <p className="font-semibold text-[#0F172A]">{loading ? '...' : percent(analysis.fundingReadinessScore)}</p>
              <p className="text-[#64748B]">Funding readiness</p>
            </div>
            <div className="rounded-[7px] bg-[#F1F5F9] px-3 py-2">
              <p className="font-semibold text-[#0F172A]">{loading ? '...' : percent(analysis.fileCompletenessScore)}</p>
              <p className="text-[#64748B]">File completeness</p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">{error}</div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[#64748B]"><AlertTriangle className="h-3.5 w-3.5" />Risk summary</div>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">{loading ? 'Loading CRM signals...' : analysis.riskSummary}</p>
              <p className="mt-2 text-xs text-[#64748B]">Red flags: {loading ? '...' : analysis.redFlags.length ? analysis.redFlags.join('; ') : 'None recorded'}</p>
            </div>
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[#64748B]"><FileText className="h-3.5 w-3.5" />Missing documents</div>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">{loading ? 'Loading documents...' : analysis.missingDocuments.length ? analysis.missingDocuments.map((item) => item.label).join(', ') : 'No required placeholder items missing'}</p>
              <p className="mt-2 text-xs text-[#64748B]">Suggested next step: {loading ? 'Loading...' : analysis.suggestedNextSteps}</p>
            </div>
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[#64748B]"><ClipboardList className="h-3.5 w-3.5" />Underwriter notes</div>
              <p className="mt-2 text-sm font-medium text-[#0F172A]">{loading ? 'Loading notes...' : analysis.latestInternalNote || state.deal?.notes || state.application?.notes || 'No underwriter notes recorded yet.'}</p>
              <p className="mt-2 text-xs text-[#64748B]">Connect a provider and storage workflow before presenting this as generated AI analysis.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
