'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from '@/types/database';

export default function MessagesPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load messages');
      console.error(error);
    } else {
      setMessages((data || []) as Message[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadMessages();
  }, [crmUserLoading, organizationId]);

  const saveMessage = async () => {
    if (!body.trim()) {
      toast.error('Message body is required');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('messages').insert({
      organization_id: organizationId,
      direction: 'outbound',
      channel: 'portal',
      recipient_email: recipientEmail || null,
      subject: subject || null,
      body,
      delivery_status: 'queued',
      sent_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Failed to save message');
      console.error(error);
    } else {
      toast.success('Message saved to timeline');
      setOpen(false);
      setRecipientEmail('');
      setSubject('');
      setBody('');
      loadMessages();
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Messages"
        subtitle={`${messages.length} internal and client communications`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Channel', 'Recipient', 'Subject', 'Status', 'Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[#A1A1AA]">Loading...</td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#A1A1AA]" />
                    <p className="text-[#71717A]">No messages logged yet</p>
                  </td>
                </tr>
              ) : (
                messages.map((message) => (
                  <tr key={message.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{message.channel || 'portal'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">{message.recipient_email || message.recipient_phone || 'Internal'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#09090B]">{message.subject || 'No subject'}</div>
                      <div className="text-xs text-[#71717A] line-clamp-1">{message.body}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-blue-100 text-blue-700">{message.delivery_status || 'logged'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#52525B]">
                      {new Date(message.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="recipient">Recipient Email</Label>
              <Input id="recipient" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveMessage} disabled={saving}>
              <Send className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
