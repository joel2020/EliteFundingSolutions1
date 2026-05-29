'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, DollarSign, FileText, Send, XCircle } from 'lucide-react';
import { CrmTopbar } from '@/components/crm/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import type { Application } from '@/types/database';

const reviewDecisions = [
  { value: 'low', label: 'Looks ready', icon: CheckCircle },
  { value: 'medium', label: 'Needs review', icon: Clock },
  { value: 'high', label: 'High concern', icon: AlertCircle },
  { value: 'declined', label: 'Decline', icon: XCircle },
];

type ReviewDocument = { id: string; application_id?: string | null; status?: string | null; document_type?: string | null };

type FundingReviewApplication = Application & {
  application_review_status?: string | null;
  notes?: string | null;
  businesses?: {
    legal_name?: string | null;
    dba?: string | null;
    monthly_gross_revenue?: number | null;
    start_date?: string | null;
    industry?: string | null;
    state?: string | null;
  } | null;
  documents?: ReviewDocument[] | null;
  deal?: { id: string; stage_slug?: string | null; requested_amount?: number | null; business_id?: string | null; title?: string | null } | null;
};

const REVIEW_REQUIRED_DOCUMENTS = [
  { type: 'completed_application', label: 'Completed signed application' },
  { type: 'bank_statements', label: 'Bank statements' },
  { type: 'drivers_license', label: "Driver's license" },
];

function currency(value?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function label(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Not set';
}

function getBusinessName(app?: FundingReviewApplication | null) {
  return app?.businesses?.legal_name || app?.businesses?.dba || app?.business_name || 'Unnamed Business';
}

function getMonthlyRevenue(app?: FundingReviewApplication | null) {
  return Number(app?.businesses?.monthly_gross_revenue || 0);
}

function getTimeInBusinessMonths(app?: FundingReviewApplication | null) {
  if (!app?.businesses?.start_date) return null;
  const startDate = new Date(app.businesses.start_date);
  if (Number.isNaN(startDate.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + now.getMonth() - startDate.getMonth());
}

function normalizeDocType(value?: string | null) {
  return String(value || '').toLowerCase().replace(/s$/, '');
}

function hasDocument(app: FundingReviewApplication, wantedType: string) {
  const wanted = normalizeDocType(wantedType);
  return (app.documents || []).some((doc) => {
    const type = normalizeDocType(doc.document_type);
    return doc.status !== 'rejected' && (
      type === wanted ||
      (wanted === 'completed_application' && ['signed_application', 'application', 'completed_application'].includes(type)) ||
      (wanted === 'bank_statement' && type === 'bank_statement') ||
      (wanted === 'driver_license' && ['driver_license', 'drivers_license', 'license_verification'].includes(type))
    );
  });
}

function getMissingDocuments(app: FundingReviewApplication) {
  return REVIEW_REQUIRED_DOCUMENTS.filter((doc) => !hasDocument(app, doc.type));
}

function getReadiness(app: FundingReviewApplication) {
  const missing = getMissingDocuments(app);
  const hasDeal = Boolean(app.deal?.id);
  if (!hasDeal) return { status: 'Deal link needed', percent: 25, tone: '#D97706', missing };
  if (!missing.length) return { status: 'Ready for lender package', percent: 100, tone: '#059669', missing };
  if (missing.length === 1) return { status: 'One item missing', percent: 75, tone: '#D97706', missing };
  return { status: 'Documents needed', percent: 45, tone: '#DC2626', missing };
}

function getRiskNotes(app: FundingReviewApplication) {
  const notes: string[] = [];
  const negativeDays = Number(app.negative_days_count || 0);
  const nsfCount = Number(app.nsf_count || 0);
  const months = getTimeInBusinessMonths(app);
  const revenue = getMonthlyRevenue(app);
  const missing = getMissingDocuments(app);

  if (negativeDays > 0) notes.push(`${negativeDays} negative day${negativeDays === 1 ? '' : 's'} recorded`);
  if (nsfCount > 0) notes.push(`${nsfCount} NSF item${nsfCount === 1 ? '' : 's'} recorded`);
  if (months !== null && months < 12) notes.push('Less than 12 months in business');
  if (revenue > 0 && app.requested_amount && Number(app.requested_amount) > revenue) notes.push('Requested amount is above one month of reported revenue');
  if (missing.length) notes.push(`${missing.length} lender package item${missing.length === 1 ? '' : 's'} missing`);
  if (app.businesses?.industry) notes.push(`Industry: ${app.businesses.industry}`);

  return notes.length ? notes : ['No risk notes recorded from the current application data.'];
}

function supportScore(app: FundingReviewApplication) {
  const readiness = getReadiness(app);
  const revenue = getMonthlyRevenue(app);
  const months = getTimeInBusinessMonths(app);
  let score = readiness.percent;
  if (revenue >= 50000) score += 10;
  if (months !== null && months >= 24) score += 10;
  if (Number(app.negative_days_count || 0) > 3) score -= 15;
  if (Number(app.nsf_count || 0) > 3) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function documentSummary(app: FundingReviewApplication) {
  const docs = app.documents || [];
  if (!docs.length) return '0 uploaded';
  const approved = docs.filter((doc) => doc.status === 'approved').length;
  return `${docs.length} uploaded${approved ? `, ${approved} approved` : ''}`;
}

function StatusPill({ value }: { value?: string | null }) {
  return <Badge variant="secondary" className="capitalize">{label(value)}</Badge>;
}

export default function FundingReviewPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading } = useCrmUser();
  const [applications, setApplications] = useState<FundingReviewApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<FundingReviewApplication | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState('medium');
  const [recommendedAmount, setRecommendedAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('applications')
      .select('id,organization_id,business_id,status,application_review_status,requested_amount,notes,submitted_at,created_at,negative_days_count,nsf_count,businesses(legal_name,dba,monthly_gross_revenue,start_date,industry,state)')
      .eq('organization_id', organizationId)
      .in('status', ['submitted', 'under_review'])
      .order('submitted_at', { ascending: false, nullsFirst: false });

    if (error) {
      toast.error('Failed to load funding review queue');
      console.error(error);
      setLoading(false);
      return;
    }

    const ids = (data || []).map((app: any) => app.id);
    const [{ data: deals, error: dealsError }, { data: documents, error: documentsError }] = ids.length
      ? await Promise.all([
          supabase.from('deals').select('id,application_id,business_id,stage_slug,requested_amount,title').in('application_id', ids).eq('organization_id', organizationId),
          supabase.from('documents').select('id,application_id,status,document_type').in('application_id', ids).eq('organization_id', organizationId),
        ])
      : [{ data: [] as any[], error: null }, { data: [] as any[], error: null }];

    if (dealsError || documentsError) {
      toast.error('Failed to load funding review queue');
      console.error(dealsError || documentsError);
      setLoading(false);
      return;
    }

    const dealsByApplication = Object.fromEntries((deals || []).map((deal: any) => [deal.application_id, deal]));
    const documentsByApplication = (documents || []).reduce<Record<string, ReviewDocument[]>>((map, document: ReviewDocument) => {
      if (!document.application_id) return map;
      map[document.application_id] = [...(map[document.application_id] || []), document];
      return map;
    }, {});

    setApplications((data || []).map((app: any) => ({
      ...app,
      deal: dealsByApplication[app.id] || null,
      documents: documentsByApplication[app.id] || [],
    })) as FundingReviewApplication[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadApplications();
  }, [crmUserLoading, organizationId, loadApplications]);

  const stats = useMemo(() => {
    const ready = applications.filter((app) => getReadiness(app).missing.length === 0 && app.deal?.id).length;
    const missingDocs = applications.reduce((sum, app) => sum + getMissingDocuments(app).length, 0);
    const totalRequested = applications.reduce((sum, app) => sum + Number(app.requested_amount || 0), 0);
    return { ready, missingDocs, totalRequested };
  }, [applications]);

  const openReview = (app: FundingReviewApplication) => {
    setSelectedApp(app);
    setReviewNotes(app.notes || '');
    setReviewDecision('medium');
    setRecommendedAmount(app.requested_amount?.toString() || '');
    setShowReviewDialog(true);
  };

  const submitReview = async () => {
    if (!selectedApp) return;
    if (!selectedApp.deal?.id) {
      toast.error('No linked deal found for this application.');
      return;
    }

    setSaving(true);
    const nextApplicationStatus = reviewDecision === 'declined' ? 'declined' : 'approved';
    const appStatusResponse = await fetch(`/api/crm/applications/${selectedApp.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextApplicationStatus, notes: reviewNotes }),
    });
    const appStatusResult = await appStatusResponse.json();

    if (!appStatusResponse.ok || !appStatusResult.success) {
      toast.error(appStatusResult.error || 'Failed to submit funding review');
      setSaving(false);
      return;
    }

    const score = supportScore(selectedApp);
    const reviewResponse = await fetch('/api/crm/underwriting-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: selectedApp.deal.id,
        application_id: selectedApp.id,
        monthly_gross_revenue: getMonthlyRevenue(selectedApp) || null,
        nsf_count: selectedApp.nsf_count || 0,
        negative_days: selectedApp.negative_days_count || 0,
        industry: selectedApp.businesses?.industry || null,
        time_in_business_months: getTimeInBusinessMonths(selectedApp),
        document_completeness_pct: getReadiness(selectedApp).percent,
        estimated_funding_max: recommendedAmount ? parseFloat(recommendedAmount) : null,
        risk_tier: reviewDecision === 'declined' ? 'decline' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D',
        underwriting_score: score,
        risk_flags: getRiskNotes(selectedApp),
        notes: reviewNotes,
        decision: reviewDecision === 'declined' ? 'declined' : 'approved',
        decision_notes: reviewNotes,
        status: 'completed',
      }),
    });
    const reviewResult = await reviewResponse.json().catch(() => ({}));

    if (!reviewResponse.ok || !reviewResult.success) {
      toast.error(reviewResult.error || 'Failed to create funding review record.');
      setSaving(false);
      return;
    }

    await fetch(`/api/crm/deals/${selectedApp.deal.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage_slug: reviewDecision === 'declined' ? 'declined' : 'offers_received',
        notes: reviewNotes,
      }),
    });

    toast.success(`Funding review ${reviewDecision === 'declined' ? 'declined' : 'completed'}`);
    setShowReviewDialog(false);
    await loadApplications();
    setSaving(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar
        title="Funding Review"
        subtitle={`${applications.length} application${applications.length === 1 ? '' : 's'} ready for internal review`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 rounded-[8px] border border-[#CBD5E1] bg-white p-4 text-sm text-[#334155]">
          <p className="font-semibold text-[#0F172A]">Internal funding review</p>
          <p className="mt-1">This section summarizes real CRM application data, document status, and staff notes. It does not make automated approval decisions.</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#64748B]">In Queue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-[#0F172A]">{applications.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#64748B]">Package Ready</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-[#0F172A]">{stats.ready}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#64748B]">Missing Docs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-[#0F172A]">{stats.missingDocs}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#64748B]">Requested Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-[#0F172A]">{currency(stats.totalRequested)}</div></CardContent></Card>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-[#64748B]">Loading funding review queue...</div>
          ) : applications.length === 0 ? (
            <div className="rounded-[8px] border border-[#E2E8F0] bg-white py-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-[#94A3B8]" />
              <p className="font-semibold text-[#0F172A]">No applications in funding review</p>
              <p className="mt-1 text-sm text-[#64748B]">Submitted applications will appear here for internal review before lender packaging.</p>
            </div>
          ) : applications.map((app) => {
            const readiness = getReadiness(app);
            const risks = getRiskNotes(app);
            return (
              <div key={app.id} className="rounded-[8px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#0F172A]">{getBusinessName(app)}</h3>
                      <StatusPill value={app.application_review_status || app.status} />
                    </div>
                    <p className="mt-1 text-sm text-[#64748B]">Submitted {date(app.submitted_at)} · Deal {app.deal?.id ? app.deal.id.slice(0, 8).toUpperCase() : 'not linked'}</p>
                  </div>
                  <Button onClick={() => openReview(app)} className="h-9 rounded-[7px] bg-[#0F2B5B]">Open Review</Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Application review status</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-[#0F172A]">{label(app.application_review_status || app.status)}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Funding readiness</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E2E8F0]"><div className="h-full" style={{ width: `${readiness.percent}%`, background: readiness.tone }} /></div>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{readiness.status}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Lender package</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F172A]">{readiness.missing.length ? `${readiness.missing.length} item(s) missing` : 'Ready to send'}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{documentSummary(app)}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Requested amount</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#0F172A]"><DollarSign className="h-4 w-4" />{Number(app.requested_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Missing documents</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F172A]">{readiness.missing.length ? readiness.missing.map((doc) => doc.label).join(', ') : 'None'}</p>
                  </div>
                  <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[#64748B]">Internal review notes</p>
                    <p className="mt-1 line-clamp-3 text-sm font-semibold text-[#0F172A]">{app.notes || 'No internal review notes yet.'}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[8px] border border-[#E2E8F0] p-3">
                  <p className="text-[11px] font-semibold uppercase text-[#64748B]">Risk notes</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {risks.map((risk) => <span key={risk} className="rounded-full bg-[#F1F5F9] px-2 py-1 text-xs font-semibold text-[#334155]">{risk}</span>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl rounded-[8px]">
          <DialogHeader>
            <DialogTitle>Internal Funding Review</DialogTitle>
            <DialogDescription>Record staff review notes for {getBusinessName(selectedApp)}. This is an internal workflow record, not an automated decision.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[#64748B]">Requested:</span><span className="ml-2 font-semibold">{currency(selectedApp?.requested_amount)}</span></div>
                <div><span className="text-[#64748B]">Revenue:</span><span className="ml-2 font-semibold">{getMonthlyRevenue(selectedApp) ? currency(getMonthlyRevenue(selectedApp)) : 'N/A'}</span></div>
                <div><span className="text-[#64748B]">Time in business:</span><span className="ml-2 font-semibold">{getTimeInBusinessMonths(selectedApp) !== null ? `${getTimeInBusinessMonths(selectedApp)} months` : 'N/A'}</span></div>
                <div><span className="text-[#64748B]">Missing docs:</span><span className="ml-2 font-semibold">{selectedApp ? getMissingDocuments(selectedApp).length : 0}</span></div>
              </div>
            </div>

            <div>
              <Label htmlFor="review_decision">Review outcome</Label>
              <Select value={reviewDecision} onValueChange={setReviewDecision}>
                <SelectTrigger id="review_decision" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reviewDecisions.map((decision) => (
                    <SelectItem key={decision.value} value={decision.value}>
                      <div className="flex items-center gap-2"><decision.icon className="h-4 w-4" />{decision.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recommended_amount">Recommended funding amount</Label>
              <Input id="recommended_amount" type="number" value={recommendedAmount} onChange={(event) => setRecommendedAmount(event.target.value)} placeholder="Enter reviewed funding amount" className="mt-1 rounded-[7px]" />
            </div>

            <div>
              <Label htmlFor="review_notes">Internal review notes</Label>
              <Textarea id="review_notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={5} placeholder="Document readiness, funding concerns, lender packaging notes, or next steps..." className="mt-1 rounded-[7px]" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={submitReview} disabled={saving || !reviewNotes.trim()} className="bg-[#0F2B5B]">{saving ? 'Saving...' : 'Save Funding Review'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
