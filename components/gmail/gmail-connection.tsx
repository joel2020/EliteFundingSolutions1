'use client';

import { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function GmailConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/gmail/status', { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) return;

      const data = await response.json();
      if (response.ok && data.connected) {
        setIsConnected(true);
        setConnectedEmail(data.email);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/gmail/auth');
      const { authUrl, error, configured } = await response.json();

      if (error) {
        if (configured === false) setConfigurationError(error);
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
      toast.success('Gmail disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Gmail');
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
                  ? 'Send and receive emails from your Gmail account'
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
              Send emails from your Gmail account<br />
              Track all email communications<br />
              Link emails to deals and applications<br />
              View email history in CRM
            </div>
            <Button variant="outline" onClick={handleDisconnect}>
              Disconnect Gmail
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-[#71717A]">
              Connect your Google Workspace email to:
            </div>
            <ul className="text-sm text-[#71717A] space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Send emails directly from your work email
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Read and respond to client emails
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Track all email conversations in CRM
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                Sync with your Gmail sent folder
              </li>
            </ul>
            {configurationError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {configurationError}
              </div>
            )}
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
