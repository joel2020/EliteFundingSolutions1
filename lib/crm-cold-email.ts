type RecordMap = Record<string, any>;

export type ColdEmailDraft = { subject: string; body: string; provider: 'azure-openai' | 'rules' };

function leadContext(lead: RecordMap) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  const business = lead.business_name || lead.legal_name || '';
  const industry = lead.industry || lead.merchant_type || '';
  const amount = lead.requested_amount || lead.funding_amount_requested || '';
  return { name, business, industry, amount };
}

function buildPrompt(lead: RecordMap) {
  const { name, business, industry, amount } = leadContext(lead);
  return [
    'Write a short, warm B2B cold outreach email from Elite Funding Solutions, a business funding brokerage, to a small-business owner.',
    `Recipient: ${name || 'the owner'}${business ? ` at ${business}` : ''}${industry ? ` (industry: ${industry})` : ''}.`,
    amount ? `They may be seeking roughly $${amount} in funding.` : '',
    'Goal: earn a reply to discuss fast working capital / revenue-based financing options.',
    'Constraints: 4-6 sentences, no fluff, one clear call to action (reply or book a quick call), professional but human. Do NOT invent approvals, rates, or specific dollar offers.',
    'Return strict JSON: {"subject": string, "body": string}.',
  ].filter(Boolean).join('\n');
}

async function callAzure(prompt: string): Promise<ColdEmailDraft | null> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const url = process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
  if (!apiKey || !url) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a sales copywriter for Elite Funding Solutions. Always output strict JSON: {"subject": string, "body": string}. Use the word funder, never lender.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`Azure AI error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  const parsed = JSON.parse(text);
  const subject = String(parsed.subject || '').trim();
  const body = String(parsed.body || '').trim();
  if (!subject || !body) return null;
  return { subject, body, provider: 'azure-openai' };
}

function ruleFallback(lead: RecordMap): ColdEmailDraft {
  const { name, business } = leadContext(lead);
  const who = name ? name.split(' ')[0] : 'there';
  const biz = business || 'your business';
  return {
    subject: `Quick funding options for ${biz}`,
    body: `Hi ${who},\n\nI'm with Elite Funding Solutions — we help business owners access fast working capital without the bank runaround. If growth, equipment, or cash flow is on your radar, I'd be glad to share a couple of options that could fit ${biz}.\n\nOpen to a quick 10-minute call this week? Just reply with a good time and I'll take it from there.\n\nBest,\nElite Funding Solutions`,
    provider: 'rules',
  };
}

// Generate an AI cold-outreach email for a lead, with a templated fallback if AI is unavailable.
export async function generateColdEmail(lead: RecordMap): Promise<ColdEmailDraft> {
  try {
    const azure = await callAzure(buildPrompt(lead));
    if (azure) return azure;
  } catch {
    // fall through to the templated fallback
  }
  return ruleFallback(lead);
}
