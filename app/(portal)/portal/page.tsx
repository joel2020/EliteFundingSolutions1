'use client';

import { useEffect, useState } from 'react';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import Link from 'next/link';
import { FileText, Upload, MessageSquare, Download, Calendar, CircleCheck as CheckCircle2, Clock, CircleAlert as AlertCircle, ArrowRight } from 'lucide-react';

interface PortalData {
  application: {
    id: string;
    status: string;
    requested_amount: number | null;
    submitted_at: string | null;
    businesses: { legal_name: string } | null;
  } | null;
  documents: Array<{
    id: string;
    label: string;
    status: string;
    created_at: string;
    file_name: string;
  }>;
  docRequests: Array<{
    id: string;
    label: string;
    status: string;
    required: boolean;
    document_type: string;
  }>;
}

const stageProgress: Record<string, number> = {
  started: 10,
  submitted: 25,
  under_review: 45,
  approved: 75,
  funded: 100,
  declined: 0,
};

const stageLabels: Record<string, { label: string; color: string; bg: string }> = {
  started: { label: 'Application Started', color: '#D97706', bg: '#FFFBEB' },
  submitted: { label: 'Application Received', color: '#2563EB', bg: '#EFF6FF' },
  under_review: { label: 'Under Review', color: '#7C3AED', bg: '#F5F3FF' },
  approved: { label: 'Approved', color: '#059669', bg: '#F0FDF4' },
  funded: { label: 'Funded', color: '#059669', bg: '#F0FDF4' },
  declined: { label: 'Not Approved', color: '#DC2626', bg: '#FEF2F2' },
};

const docStatusConfig: Record<string, { label: string; color: string }> = {
  uploaded: { label: 'Uploaded', color: '#2563EB' },
  in_review: { label: 'In Review', color: '#D97706' },
  approved: { label: 'Approved', color: '#059669' },
  rejected: { label: 'Rejected', color: '#DC2626' },
  needs_replacement: { label: 'Needs Replacement', color: '#DC2626' },
  requested: { label: 'Requested', color: '#D97706' },
};

export default function PortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [message, setMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const u = authData.user;

      if (!u) {
        setLoading(false);
        return;
      }

      setUser({ email: u.email ?? '', id: u.id });

      // Load owner record to find linked applications
      const [{ data: owner }, { data: docs }, { data: docReqs }] = await Promise.all([
        supabase
          .from('owners')
          .select('id')
          .eq('user_id', u.id)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('id,label,status,created_at,file_name')
          .eq('uploaded_by_user_id', u.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('document_requests')
          .select('id,label,status,required,document_type')
          .eq('organization_id', DEFAULT_ORG_ID)
          .order('required', { ascending: false })
          .limit(10),
      ]);

      // Try to find application via owner
      let application = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      if (owner) {
        const { data: bos } = await db
          .from('business_owners')
          .select('business_id')
          .eq('owner_id', (owner as { id: string }).id)
          .limit(1)
          .maybeSingle();

        if (bos) {
          const { data: app } = await db
            .from('applications')
            .select('id,status,requested_amount,submitted_at,businesses(legal_name)')
            .eq('business_id', (bos as { business_id: string }).business_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          application = app;
        }
      }

      setData({
        application: application as PortalData['application'],
        documents: (docs ?? []) as PortalData['documents'],
        docRequests: (docReqs ?? []) as PortalData['docRequests'],
      });
      setLoading(false);
    };

    init();
  }, []);

  const sendMessage = async () => {
    if (!message.trim() || !user) return;
    setSendingMsg(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      organization_id: DEFAULT_ORG_ID,
      application_id: data?.application?.id ?? null,
      direction: 'inbound',
      channel: 'portal',
      body: message,
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
    });
    setMessage('');
    setSendingMsg(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[14px] text-[#A1A1AA]">Loading your portal…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-[15px] text-[#71717A] mb-4">Please sign in to access your portal.</p>
        <Link href="/login" className="btn-primary">Sign In</Link>
      </div>
    );
  }

  const app = data?.application;
  const pct = app ? (stageProgress[app.status] ?? 0) : 0;
  const stageInfo = app ? (stageLabels[app.status] ?? stageLabels.submitted) : null;
  const pendingDocs = data?.docRequests.filter((d) => d.status === 'requested') ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-[24px] font-bold text-[#09090B] tracking-tight">
          Welcome back{user.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-[14px] text-[#71717A] mt-1">
          Your funding application portal. Track status, upload documents, and message your advisor.
        </p>
      </div>

      {/* Application status */}
      {app ? (
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[16px] font-semibold text-[#09090B]">
                {app.businesses?.legal_name ?? 'Your Application'}
              </h2>
              <p className="text-[13px] text-[#A1A1AA] mt-0.5">
                Application ID: {app.id.slice(0, 12).toUpperCase()}
              </p>
            </div>
            {stageInfo && (
              <span
                className="inline-flex items-center rounded-[8px] px-3 py-1.5 text-[13px] font-semibold"
                style={{ backgroundColor: stageInfo.bg, color: stageInfo.color }}
              >
                {stageInfo.label}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[12px] text-[#A1A1AA] mb-2">
              <span>Application Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-[#F4F4F5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Amount Requested', value: app.requested_amount ? `$${Number(app.requested_amount).toLocaleString()}` : '—' },
              { label: 'Submitted', value: app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not yet' },
              { label: 'Documents', value: `${(data?.documents ?? []).length} uploaded` },
            ].map((item) => (
              <div key={item.label} className="bg-[#FAFAFA] rounded-[10px] p-3">
                <div className="text-[12px] text-[#A1A1AA] mb-1">{item.label}</div>
                <div className="text-[15px] font-semibold text-[#09090B]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] p-8 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <FileText className="w-10 h-10 text-[#E4E4E7] mx-auto mb-3" />
          <p className="text-[15px] font-medium text-[#09090B] mb-2">No application found</p>
          <p className="text-[14px] text-[#71717A] mb-5">Complete a funding application to get started.</p>
          <Link href="/apply" className="btn-primary">
            Apply for Funding
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Document checklist */}
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F4F5]">
            <h3 className="text-[15px] font-semibold text-[#09090B] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#2563EB]" />
              Document Checklist
            </h3>
            {pendingDocs.length > 0 && (
              <span className="badge-warning">{pendingDocs.length} needed</span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: 'Bank Statements (3 months)', done: false, required: true },
              { label: "Driver's License / State ID", done: false, required: true },
              { label: 'Voided Check', done: false, required: true },
              { label: 'Processing Statements', done: false, required: false },
              { label: 'Business Tax Returns', done: false, required: false },
            ].map((doc) => (
              <div key={doc.label} className="flex items-center justify-between py-2 border-b border-[#F4F4F5] last:border-0">
                <div className="flex items-center gap-2">
                  {doc.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  )}
                  <span className="text-[13px] text-[#52525B]">{doc.label}</span>
                  {doc.required && !doc.done && (
                    <span className="text-[11px] text-[#EF4444] font-medium">Required</span>
                  )}
                </div>
                {!doc.done && (
                  <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB] cursor-pointer hover:underline">
                    <Upload className="w-3 h-3" />
                    Upload
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Message advisor */}
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F4F5]">
            <h3 className="text-[15px] font-semibold text-[#09090B] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#2563EB]" />
              Message Your Advisor
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="bg-[#EFF6FF] rounded-[10px] px-4 py-3 text-[13px] text-[#2563EB]">
              <strong>Elite Funding Solutions Team</strong> — Your advisor typically responds within 2 business hours.
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about your application, documents, or offers…"
              rows={4}
              className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-[10px] px-4 py-3 text-[14px] text-[#09090B] placeholder-[#A1A1AA] resize-none focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#EFF6FF] transition-all"
            />

            <button
              onClick={sendMessage}
              disabled={!message.trim() || sendingMsg}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#2563EB] text-white font-semibold text-[14px] h-10 px-5 hover:bg-[#1D4ED8] transition-all disabled:opacity-50"
            >
              {sendingMsg ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <FileText className="w-5 h-5" />, label: 'View Application', href: '/apply' },
          { icon: <Download className="w-5 h-5" />, label: 'Download Contracts', href: '#' },
          { icon: <Calendar className="w-5 h-5" />, label: 'Schedule a Call', href: '/contact' },
          { icon: <Clock className="w-5 h-5" />, label: 'Application History', href: '#' },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 bg-white border border-[#E4E4E7] rounded-[12px] p-4 hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-all group text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="text-[#71717A] group-hover:text-[#2563EB] transition-colors">
              {action.icon}
            </div>
            <span className="text-[13px] font-medium text-[#52525B] group-hover:text-[#09090B] transition-colors">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
