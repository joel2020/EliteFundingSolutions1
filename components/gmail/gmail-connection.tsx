'use client';

import { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type GmailStatusReason = 'gmail_token_expired' | 'missing_gmail_send_scope' | string;

function gmailStatusMessage(reason: GmailStatusReason | null, email: string | null) {
  if (reason === 'missing_gmail_send_scope') {
    return 'Google Workspace is connected without Gmail send permission. Reconnect and approve email sending.';
  }
  if (reason === 'gmail_token_expired') {
    return 'Google Workspace session expired. Reconnect this account before sending funder packages.';
  }
  if (email) {
    return 'Reconnect Google Workspace before sending funder packages.';
  }
  return 'Connect your Google Workspace email.';
}

export function GmailConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [statusReason, setStatusReason] = useState<GmailStatusReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/gmail/status', { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) return;

      const data = await response.json();
      const email = data.email || null;
      setConnectedEmail(email);
      setNeedsReconnect(Boolean(data.needsReconnect));
      setStatusReason(data.reason || null);
      if (response.ok && data.connected) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/gmail/auth');
      const { authUrl, error } = await response.json();

      if (error) {
        toast.error(error);
        setConnecting(false);
        return;
      }

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      toast.error('Failed to connect Gmail');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to disconnect Gmail');

      setIsConnected(false);
      setConnectedEmail(null);
      setNeedsReconnect(false);
      setStatusReason(null);
      toast.success('Gmail disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Gmail');
    }
  };

  const handleSendTest = async () => {
    if (!connectedEmail) return;
    setSendingTest(true);

    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: connectedEmail,
          subject: 'Elite Funding CRM Gmail test',
          body: 'This test confirms the CRM can send email through the connected Google Workspace account.',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send test email');
      toast.success('Test email sent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#A1A1AA]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                {isConnected 
                  ? 'Send funder emails from your Google Workspace account'
                  : 'Connect your Google Workspace email'}
              </CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="w-3 h-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            <div className="bg-[#F4F4F5] rounded-lg p-4">
              <div className="text-sm text-[#71717A] mb-1">Connected Account</div>
              <div className="font-medium text-[#09090B]">{connectedEmail}</div>
            </div>
            <div className="text-sm text-[#71717A]">
              Send funder submissions from your connected account<br />
              Keep funder replies routed to the same inbox<br />
              CRM logs sends that you initiate
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleSendTest} disabled={sendingTest}>
                {sendingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDisconnect}>
                Disconnect Gmail
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {needsReconnect || connectedEmail ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">Reconnect required</div>
                    <div>{gmailStatusMessage(statusReason, connectedEmail)}</div>
                    {connectedEmail ? <div className="mt-1 text-amber-800">{connectedEmail}</div> : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="text-sm text-[#71717A]">
              Connect your Google Workspace email to:
            </div>
            <ul className="text-sm text-[#71717A] space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Send funder submissions directly from your work email
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Route funder replies back to the same inbox
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Store a CRM record of emails sent from the app
              </li>
            </ul>
            <Button 
              onClick={handleConnect} 
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Connect Google Workspace
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
