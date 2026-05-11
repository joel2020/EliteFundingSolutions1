'use client';

import { useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, TrendingUp, Calculator } from 'lucide-react';

// ─── Underwriting calculator ──────────────────────────────────────────────
function calculateUnderwriting(inputs: UWInputs): UWOutputs {
  const {
    monthly_revenue, avg_daily_balance, deposit_count, nsf_count,
    negative_days, existing_balance, existing_daily_pmts, time_in_business,
    credit_range, has_tax_lien, has_bankruptcy
  } = inputs;

  let score = 100;
  const flags: string[] = [];

  // Revenue scoring
  if (monthly_revenue < 10000) { score -= 30; flags.push('Low monthly revenue'); }
  else if (monthly_revenue < 20000) { score -= 10; }

  // Average daily balance
  if (avg_daily_balance < 2000) { score -= 25; flags.push('Low average daily balance'); }
  else if (avg_daily_balance < 5000) { score -= 10; }

  // NSF count
  if (nsf_count >= 5) { score -= 20; flags.push('High NSF count'); }
  else if (nsf_count >= 2) { score -= 10; }

  // Negative days
  if (negative_days >= 5) { score -= 20; flags.push('Too many negative days'); }
  else if (negative_days >= 2) { score -= 8; }

  // Time in business
  if (time_in_business < 6) { score -= 25; flags.push('Short time in business'); }
  else if (time_in_business < 12) { score -= 10; }

  // Credit score
  const creditPoints: Record<string, number> = {
    below_500: -20, '500_549': -10, '550_599': -5,
    '600_649': 0, '650_699': 5, '700_749': 10, '750_plus': 15,
  };
  score += creditPoints[credit_range] ?? 0;
  if (credit_range === 'below_500') flags.push('Low credit score');

  // Derogatory
  if (has_tax_lien) { score -= 15; flags.push('Open tax lien'); }
  if (has_bankruptcy) { score -= 20; flags.push('Open bankruptcy'); }

  // Existing payment burden
  const burden = monthly_revenue > 0
    ? ((existing_daily_pmts * 21) / monthly_revenue) * 100
    : 0;
  if (burden > 50) { score -= 20; flags.push('High existing payment burden'); }
  else if (burden > 30) { score -= 10; }

  score = Math.max(0, Math.min(100, score));

  // Risk tier
  let risk_tier: 'A' | 'B' | 'C' | 'D' | 'decline';
  if (score >= 80) risk_tier = 'A';
  else if (score >= 65) risk_tier = 'B';
  else if (score >= 50) risk_tier = 'C';
  else if (score >= 30) risk_tier = 'D';
  else risk_tier = 'decline';

  // Funding range: typically 1x to 2x monthly revenue
  const base = monthly_revenue;
  const min_funding = risk_tier === 'decline' ? 0 : Math.round(base * 0.8 / 1000) * 1000;
  const max_funding = risk_tier === 'decline' ? 0 : Math.round(
    base * (risk_tier === 'A' ? 2.5 : risk_tier === 'B' ? 2 : risk_tier === 'C' ? 1.5 : 1) / 1000
  ) * 1000;

  // Factor rate based on risk
  const factor_rates: Record<string, number> = {
    A: 1.20, B: 1.28, C: 1.35, D: 1.42, decline: 0
  };
  const factor_rate = factor_rates[risk_tier];

  // Payment estimate (120-day term typical)
  const mid_funding = (min_funding + max_funding) / 2;
  const payback = mid_funding * factor_rate;
  const daily_pmt = payback / 120;
  const weekly_pmt = daily_pmt * 5;
  const max_safe = monthly_revenue * 0.15; // 15% of monthly rev per day max

  return {
    score,
    risk_tier,
    risk_flags: flags,
    min_funding,
    max_funding,
    factor_rate,
    payback_amount: Math.round(payback),
    daily_payment: Math.round(daily_pmt),
    weekly_payment: Math.round(weekly_pmt * 5),
    max_safe_daily: Math.round(max_safe),
    burden_pct: Math.round(burden),
    renewal_eligible: score >= 60 && existing_balance === 0,
  };
}

interface UWInputs {
  monthly_revenue: number;
  avg_daily_balance: number;
  deposit_count: number;
  nsf_count: number;
  negative_days: number;
  existing_balance: number;
  existing_daily_pmts: number;
  time_in_business: number;
  credit_range: string;
  has_tax_lien: boolean;
  has_bankruptcy: boolean;
}

interface UWOutputs {
  score: number;
  risk_tier: 'A' | 'B' | 'C' | 'D' | 'decline';
  risk_flags: string[];
  min_funding: number;
  max_funding: number;
  factor_rate: number;
  payback_amount: number;
  daily_payment: number;
  weekly_payment: number;
  max_safe_daily: number;
  burden_pct: number;
  renewal_eligible: boolean;
}

const tierColors: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: '#F0FDF4', text: '#059669', label: 'A — Strong' },
  B: { bg: '#EFF6FF', text: '#2563EB', label: 'B — Good' },
  C: { bg: '#FFFBEB', text: '#D97706', label: 'C — Moderate' },
  D: { bg: '#FEF2F2', text: '#DC2626', label: 'D — High Risk' },
  decline: { bg: '#FEF2F2', text: '#DC2626', label: 'Decline' },
};

// ─── Page ─────────────────────────────────────────────────────────────────
export default function UnderwritingPage() {
  const [inputs, setInputs] = useState<UWInputs>({
    monthly_revenue: 0, avg_daily_balance: 0, deposit_count: 0,
    nsf_count: 0, negative_days: 0, existing_balance: 0,
    existing_daily_pmts: 0, time_in_business: 12,
    credit_range: '650_699', has_tax_lien: false, has_bankruptcy: false,
  });
  const [result, setResult] = useState<UWOutputs | null>(null);

  const update = (key: keyof UWInputs, value: number | string | boolean) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const calculate = () => setResult(calculateUnderwriting(inputs));

  const numInput = (label: string, key: keyof UWInputs, isCurrency = false, hint?: string) => (
    <div>
      <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">{label}</label>
      <div className="relative">
        {isCurrency && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] text-[14px]">$</span>
        )}
        <input
          type="number"
          min={0}
          value={inputs[key] as number || ''}
          onChange={(e) => update(key, Number(e.target.value))}
          className={`input-field w-full ${isCurrency ? 'pl-7' : ''}`}
          placeholder="0"
        />
      </div>
      {hint && <p className="text-[12px] text-[#A1A1AA] mt-1">{hint}</p>}
    </div>
  );

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Underwriting Calculator"
        subtitle="Analyze deal risk and calculate funding parameters"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1100px]">
          {/* Inputs */}
          <div
            className="lg:col-span-2 bg-white border border-[#E4E4E7] rounded-[16px] p-6"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <h2 className="text-[16px] font-semibold text-[#09090B] mb-6 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#2563EB]" />
              Input Data
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numInput('Monthly Gross Revenue', 'monthly_revenue', true)}
              {numInput('Average Daily Balance', 'avg_daily_balance', true)}
              {numInput('Monthly Deposit Count', 'deposit_count')}
              {numInput('NSF Count (last 3 months)', 'nsf_count', false, 'Returned / insufficient fund items')}
              {numInput('Negative Days (last 3 months)', 'negative_days')}
              {numInput('Time in Business (months)', 'time_in_business')}
              {numInput('Existing Advance Balance', 'existing_balance', true)}
              {numInput('Existing Daily Payments', 'existing_daily_pmts', true)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">Credit Score Range</label>
                <select
                  value={inputs.credit_range}
                  onChange={(e) => update('credit_range', e.target.value)}
                  className="input-field w-full"
                >
                  {[
                    { value: 'below_500', label: 'Below 500' },
                    { value: '500_549', label: '500 – 549' },
                    { value: '550_599', label: '550 – 599' },
                    { value: '600_649', label: '600 – 649' },
                    { value: '650_699', label: '650 – 699' },
                    { value: '700_749', label: '700 – 749' },
                    { value: '750_plus', label: '750+' },
                  ].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-3 justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={inputs.has_tax_lien} onChange={(e) => update('has_tax_lien', e.target.checked)} className="w-4 h-4" />
                  <span className="text-[13px] text-[#52525B]">Open tax lien</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={inputs.has_bankruptcy} onChange={(e) => update('has_bankruptcy', e.target.checked)} className="w-4 h-4" />
                  <span className="text-[13px] text-[#52525B]">Open bankruptcy</span>
                </label>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#F4F4F5]">
              <button
                onClick={calculate}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#2563EB] text-white font-semibold text-[15px] h-11 px-6 hover:bg-[#1D4ED8] transition-all"
              >
                <TrendingUp className="w-4 h-4" />
                Calculate Underwriting
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col gap-4">
            {result ? (
              <>
                {/* Risk tier */}
                <div
                  className="bg-white border border-[#E4E4E7] rounded-[16px] p-5"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">Risk Assessment</div>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-14 h-14 rounded-[12px] flex items-center justify-center text-[22px] font-bold"
                      style={{ backgroundColor: tierColors[result.risk_tier].bg, color: tierColors[result.risk_tier].text }}
                    >
                      {result.risk_tier === 'decline' ? '✕' : result.risk_tier}
                    </div>
                    <div>
                      <div className="text-[16px] font-bold text-[#09090B]">
                        {tierColors[result.risk_tier].label}
                      </div>
                      <div className="text-[13px] text-[#71717A]">Score: {result.score}/100</div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 bg-[#F4F4F5] rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${result.score}%`,
                        backgroundColor: result.score >= 65 ? '#10B981' : result.score >= 40 ? '#F59E0B' : '#EF4444'
                      }}
                    />
                  </div>

                  {/* Funding range */}
                  {result.risk_tier !== 'decline' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#F4F4F5] rounded-[10px] p-3">
                        <div className="text-[11px] text-[#A1A1AA] mb-0.5">Min Funding</div>
                        <div className="text-[15px] font-bold text-[#09090B]">{fmt(result.min_funding)}</div>
                      </div>
                      <div className="bg-[#F4F4F5] rounded-[10px] p-3">
                        <div className="text-[11px] text-[#A1A1AA] mb-0.5">Max Funding</div>
                        <div className="text-[15px] font-bold text-[#09090B]">{fmt(result.max_funding)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Offer parameters */}
                {result.risk_tier !== 'decline' && (
                  <div
                    className="bg-white border border-[#E4E4E7] rounded-[16px] p-5"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">Estimated Offer Terms</div>
                    <div className="flex flex-col gap-2.5">
                      {[
                        ['Factor Rate', result.factor_rate.toFixed(2)],
                        ['Payback Amount', fmt(result.payback_amount)],
                        ['Daily Payment', fmt(result.daily_payment)],
                        ['Weekly Payment', fmt(result.weekly_payment)],
                        ['Max Safe Daily Pmt', fmt(result.max_safe_daily)],
                        ['Existing Pmt Burden', `${result.burden_pct}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#F4F4F5] last:border-0">
                          <span className="text-[13px] text-[#71717A]">{label}</span>
                          <span className="text-[14px] font-semibold text-[#09090B]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk flags */}
                {result.risk_flags.length > 0 && (
                  <div
                    className="bg-white border border-[#E4E4E7] rounded-[16px] p-5"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">Risk Flags</div>
                    <div className="flex flex-col gap-2">
                      {result.risk_flags.map((flag) => (
                        <div key={flag} className="flex items-center gap-2 text-[13px] text-[#D97706]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {flag}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.risk_tier !== 'decline' && result.risk_flags.length === 0 && (
                  <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#DCFCE7] rounded-[12px] px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    <span className="text-[13px] text-[#059669] font-medium">No risk flags identified</span>
                  </div>
                )}
              </>
            ) : (
              <div
                className="bg-white border border-[#E4E4E7] rounded-[16px] p-8 text-center"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <Calculator className="w-10 h-10 text-[#E4E4E7] mx-auto mb-3" />
                <p className="text-[14px] text-[#A1A1AA]">Enter deal data and click Calculate to see the underwriting analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
