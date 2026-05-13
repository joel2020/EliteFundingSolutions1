'use client';

import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, ArrowRight } from 'lucide-react';

export default function ContactPage() {
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

    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json();

    setSubmitting(false);
    if (!response.ok || !result.success) {
      setError(result.error || 'We could not send your message. Please call us directly.');
      return;
    }

    setSent(true);
  };

  return (
    <div className="section">
      <div className="container-page">
        <div className="max-w-[600px] mb-12">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">Get in Touch</p>
          <h1 className="text-[40px] font-bold text-[#09090B] tracking-tight mb-4">
            Speak with a funding advisor
          </h1>
          <p className="text-[17px] text-[#71717A] leading-relaxed">
            Have questions about your options? Our team is available Monday through Friday, 8am to 8pm ET.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {sent ? (
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[16px] p-8 text-center">
                <div className="text-[28px] mb-3">✓</div>
                <h2 className="text-[20px] font-bold text-[#09090B] mb-2">Message Received</h2>
                <p className="text-[14px] text-[#71717A]">We&apos;ll be in touch within 2 business hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <input type="text" tabIndex={-1} autoComplete="off" value={form.bot_field} onChange={(e) => setForm({ ...form, bot_field: e.target.value })} className="hidden" aria-hidden="true" />
                {error && <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">Full Name *</label>
                    <input id="contact-name" type="text" required aria-required="true" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">Email *</label>
                    <input id="contact-email" type="email" required aria-required="true" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field w-full" placeholder="you@company.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">Phone</label>
                  <input id="contact-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field w-full" placeholder="(XXX) XXX-XXXX" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#52525B] mb-1.5">How can we help?</label>
                  <textarea id="contact-message" rows={5} required aria-required="true" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full bg-white border border-[#E4E4E7] rounded-[10px] px-4 py-3 text-[15px] text-[#09090B] placeholder-[#A1A1AA] resize-none focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#EFF6FF] transition-all" placeholder="Tell us about your funding needs, questions, or concerns…" />
                </div>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-[10px] bg-[#2563EB] text-white font-semibold text-[15px] h-11 px-6 hover:bg-[#1D4ED8] transition-all">
                  {submitting ? 'Sending…' : 'Send Message'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {[
              { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: '(888) 400-2580', sub: 'Mon – Fri, 8am – 8pm ET' },
              { icon: <Mail className="w-4 h-4" />, label: 'Email', value: 'info@elitefundingsolution.com', sub: 'Typically reply within 2 hours' },
              { icon: <MapPin className="w-4 h-4" />, label: 'Headquarters', value: '2202 N Westshore Blvd.', sub: 'Tampa, FL 33607' },
              { icon: <Clock className="w-4 h-4" />, label: 'Hours', value: 'Mon – Fri: 8am – 8pm ET', sub: 'Sat: 9am – 2pm ET' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[9px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <div className="text-[12px] text-[#A1A1AA] mb-0.5">{item.label}</div>
                  <div className="text-[14px] font-medium text-[#09090B]">{item.value}</div>
                  <div className="text-[12px] text-[#71717A]">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
