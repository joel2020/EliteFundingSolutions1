'use client';

import { useState } from 'react';
import { ArrowRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { COMPANY } from '@/lib/company';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', type: 'general', bot_field: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) || (form.phone && form.phone.replace(/\D/g, '').length < 10) || form.message.trim().length < 5) {
      setError('Please provide your name, a valid email, a valid phone if included, and a message.');
      return;
    }
    setSubmitting(true);
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok || !result.success) {
      setError(result.error || 'We could not send your message. Please call us directly.');
      return;
    }
    setSent(true);
  };

  return (
    <main className="section bg-[#030812]">
      <div className="container-page">
        <div className="mb-12 max-w-3xl">
          <p className="eyebrow mb-3">Contact</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Speak with a funding advisor.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">Ask questions about documentation, program fit, timelines, or an active funding request. We keep the conversation practical and pressure-free.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="premium-card p-6 md:p-8">
            {sent ? (
              <div className="rounded-3xl border border-[#DCFCE7] bg-[#F0FDF4] p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#05101d] text-2xl text-[#047857]">OK</div>
                <h2 className="text-2xl font-semibold text-[#0A1628]">Message received</h2>
                <p className="mt-2 text-[#5A6A85]">An Elite Funding Solutions advisor will follow up with next steps.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <input type="text" tabIndex={-1} autoComplete="off" value={form.bot_field} onChange={(e) => setForm({ ...form, bot_field: e.target.value })} className="hidden" aria-hidden="true" />
                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#0A1628]">Full name *<input id="contact-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field mt-2" placeholder="Your name" /></label>
                  <label className="block text-sm font-semibold text-[#0A1628]">Email *<input id="contact-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field mt-2" placeholder="you@company.com" /></label>
                </div>
                <label className="block text-sm font-semibold text-[#0A1628]">Phone<input id="contact-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field mt-2" placeholder="(XXX) XXX-XXXX" /></label>
                <label className="block text-sm font-semibold text-[#0A1628]">How can we help? *<textarea id="contact-message" rows={6} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-2 w-full resize-none rounded-[10px] border border-[#DDE3EF] bg-white px-4 py-3 text-[15px] text-[#0A1628] outline-none transition focus:border-[#061326] focus:ring-4 focus:ring-[#061326]/10" placeholder="Tell us about the funding objective, timeline, and questions you want answered." /></label>
                <button type="submit" disabled={submitting} className="btn-gold h-12 px-7">
                  {submitting ? 'Sending...' : 'Send message'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            {[
              { icon: Phone, label: 'Phone', value: COMPANY.phone, sub: 'Mon-Fri, 8am-8pm ET', href: `tel:${COMPANY.phoneHref}` },
              { icon: Mail, label: 'Email', value: COMPANY.email, sub: 'Funding and application support', href: `mailto:${COMPANY.email}` },
              { icon: MapPin, label: 'Headquarters', value: COMPANY.street, sub: `${COMPANY.city}, ${COMPANY.state} ${COMPANY.zip}` },
              { icon: Clock, label: 'Hours', value: 'Mon-Fri: 8am-8pm ET', sub: 'Advisor availability may vary' },
            ].map(({ icon: Icon, label, value, sub, href }) => {
              const content = <><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#061326] text-[#C9A84C]"><Icon className="h-4 w-4" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8A6A22]">{label}</p><p className="mt-1 font-semibold text-[#0A1628]">{value}</p><p className="mt-1 text-sm text-[#5A6A85]">{sub}</p></div></>;
              return href ? <a key={label} href={href} className="premium-card flex gap-4 p-5 transition hover:border-[#C9A84C]/60">{content}</a> : <div key={label} className="premium-card flex gap-4 p-5">{content}</div>;
            })}
          </aside>
        </div>
      </div>
    </main>
  );
}
