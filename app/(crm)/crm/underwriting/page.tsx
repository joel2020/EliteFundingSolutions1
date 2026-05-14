'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { FileText, CheckCircle, XCircle, Clock, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import type { Application } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const riskLevels = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  { value: 'high', label: 'High Risk', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  { value: 'declined', label: 'Decline', color: 'bg-red-100 text-red-700', icon: XCircle },
];

type UnderwritingApplication = Application & {
  businesses?: {
    legal_name?: string | null;
    dba?: string | null;
    monthly_gross_revenue?: number | null;
    start_date?: string | null;
  } | null;
  documents?: Array<{ id: string; status?: string | null }> | null;
};

const getBusinessName = (app?: UnderwritingApplication | null) =>
  app?.businesses?.legal_name || app?.businesses?.dba || app?.business_name || 'Unnamed Business';

const getMonthlyRevenue = (app?: UnderwritingApplication | null) =>
  Number(app?.businesses?.monthly_gross_revenue || 0);

const getTimeInBusinessMonths = (app?: UnderwritingApplication | null) => {
  if (!app?.businesses?.start_date) return null;
  const startDate = new Date(app.businesses.start_date);
  if (Number.isNaN(startDate.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + now.getMonth() - startDate.getMonth());
};

const getDocumentSummary = (app?: UnderwritingApplication | null) => {
  const documents = app?.documents || [];
  if (documents.length === 0) return '0 uploaded';
  const approved = documents.filter((doc) => doc.status === 'approved').length;
  const pending = documents.filter((doc) => doc.status !== 'approved').length;
  return approved > 0 ? `${documents.length} uploaded, ${approved} approved` : `${documents.length} uploaded, ${pending} pending`;
};

export default function UnderwritingPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [applications, setApplications] = useState<UnderwritingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<UnderwritingApplication | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [riskAssessment, setRiskAssessment] = useState('medium');
  const [recommendedAmount, setRecommendedAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('applications')
      .select('id,organization_id,business_id,status,requested_amount,submitted_at,created_at,businesses(legal_name,dba,monthly_gross_revenue,start_date),documents(id,status)')
      .eq('organization_id', organizationId)
      .in('status', ['submitted', 'under_review'])
      .order('submitted_at', { ascending: false, nullsFirst: false });

    if (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } else if (data) {
      setApplications(data as UnderwritingApplication[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadApplications();
  }, [crmUserLoading, organizationId, loadApplications]);

  const openReview = (app: UnderwritingApplication) => {
    setSelectedApp(app);
    setReviewNotes('');
    setRiskAssessment('medium');
    setRecommendedAmount(app.requested_amount?.toString() || '');
    setShowReviewDialog(true);
  };

  const submitReview = async () => {
    if (!selectedApp) return;

    setSaving(true);

    // Update application status
    const { error: appError } = await supabase
      .from('applications')
      .update({ 
        status: riskAssessment === 'declined' ? 'declined' : 'approved',
        underwriting_notes: reviewNotes,
      })
      .eq('id', selectedApp.id);

    if (appError) {
      toast.error('Failed to submit review');
      console.error(appError);
      setSaving(false);
      return;
    }

    // Create underwriting review record
    const { error: reviewError } = await supabase
      .from('underwriting_reviews')
      .insert({
        organization_id: organizationId,
        application_id: selectedApp.id,
        risk_level: riskAssessment,
        notes: reviewNotes,
        recommended_amount: recommendedAmount ? parseFloat(recommendedAmount) : null,
        status: riskAssessment === 'declined' ? 'declined' : 'approved',
      });

    if (reviewError) {
      console.error('Failed to create review record:', reviewError);
    }

    toast.success(`Application ${riskAssessment === 'declined' ? 'declined' : 'approved'}`);
    setShowReviewDialog(false);
    loadApplications();
    setSaving(false);
  };

  const calculateScore = (app: UnderwritingApplication) => {
    // Simple scoring algorithm
    let score = 50;
    const monthlyRevenue = getMonthlyRevenue(app);
    const timeInBusinessMonths = getTimeInBusinessMonths(app);
    
    if (monthlyRevenue) {
      if (monthlyRevenue > 100000) score += 20;
      else if (monthlyRevenue > 50000) score += 10;
      else if (monthlyRevenue > 25000) score += 5;
    }
    
    if (app.requested_amount && monthlyRevenue) {
      const ratio = app.requested_amount / monthlyRevenue;
      if (ratio < 0.5) score += 15;
      else if (ratio < 1) score += 10;
      else if (ratio < 2) score += 5;
    }
    
    if (timeInBusinessMonths) {
      if (timeInBusinessMonths > 24) score += 15;
      else if (timeInBusinessMonths > 12) score += 10;
      else if (timeInBusinessMonths > 6) score += 5;
    }

    return Math.min(100, Math.max(0, score));
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Underwriting"
        subtitle={`${applications.length} applications in review queue`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">In Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                {applications.filter(a => a.status === 'under_review').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Pending Docs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                {applications.filter(a => a.status === 'docs_requested').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                ${applications.reduce((sum, a) => sum + (a.requested_amount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Avg Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                ${applications.length > 0 ? Math.round(applications.reduce((sum, a) => sum + (a.requested_amount || 0), 0) / applications.length).toLocaleString() : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A]">No applications in underwriting queue</p>
            </div>
          ) : (
            applications.map((app) => {
              const score = calculateScore(app);
              const monthlyRevenue = getMonthlyRevenue(app);
              const timeInBusinessMonths = getTimeInBusinessMonths(app);
              return (
                <div
                  key={app.id}
                  className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-[#09090B]">
                          {getBusinessName(app)}
                        </h3>
                        <Badge variant="secondary">{app.status.replace('_', ' ')}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Requested Amount</div>
                          <div className="flex items-center gap-1 font-semibold text-[#09090B]">
                            <DollarSign className="w-4 h-4" />
                            {app.requested_amount?.toLocaleString() || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Documents</div>
                          <div className="font-semibold text-[#09090B]">
                            {getDocumentSummary(app)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Submitted</div>
                          <div className="font-semibold text-[#09090B]">
                            {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Monthly Revenue</div>
                          <div className="font-semibold text-[#09090B]">
                            {monthlyRevenue ? `$${monthlyRevenue.toLocaleString()}` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Time in Business</div>
                          <div className="font-semibold text-[#09090B]">
                            {timeInBusinessMonths !== null ? `${timeInBusinessMonths} months` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Document Status</div>
                          <div className="font-semibold text-[#09090B]">
                            {getDocumentSummary(app)}
                          </div>
                        </div>
                      </div>

                      {/* Risk Score */}
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-[#71717A] mb-1">Risk Score</div>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-[#F4F4F5] rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className={`font-bold ${getScoreColor(score)}`}>
                              {score}/100
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => openReview(app)}>
                        Review Application
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Underwriting Review</DialogTitle>
            <DialogDescription>
              Review and assess {getBusinessName(selectedApp)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Application Summary */}
            <div className="bg-[#F4F4F5] rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[#71717A]">Requested:</span>
                  <span className="ml-2 font-semibold">${selectedApp?.requested_amount?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#71717A]">Revenue:</span>
                  <span className="ml-2 font-semibold">{getMonthlyRevenue(selectedApp) ? `$${getMonthlyRevenue(selectedApp).toLocaleString()}` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#71717A]">Time in Business:</span>
                  <span className="ml-2 font-semibold">{getTimeInBusinessMonths(selectedApp) !== null ? `${getTimeInBusinessMonths(selectedApp)} months` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#71717A]">Documents:</span>
                  <span className="ml-2 font-semibold">{getDocumentSummary(selectedApp)}</span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="risk_assessment">Risk Assessment</Label>
              <Select value={riskAssessment} onValueChange={setRiskAssessment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {riskLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex items-center gap-2">
                        <level.icon className="w-4 h-4" />
                        {level.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recommended_amount">Recommended Amount</Label>
              <Input
                id="recommended_amount"
                type="number"
                value={recommendedAmount}
                onChange={(e) => setRecommendedAmount(e.target.value)}
                placeholder="Enter recommended funding amount"
              />
            </div>

            <div>
              <Label htmlFor="review_notes">Review Notes</Label>
              <Textarea
                id="review_notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                placeholder="Enter your underwriting notes and assessment..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={submitReview} disabled={saving || !reviewNotes}>
              {saving ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
