'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function GmailStatusToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const gmailStatus = searchParams?.get('gmail');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected successfully!');
    } else if (gmailStatus === 'missing_gmail_send_scope') {
      toast.error('Google did not grant Gmail send permission. Reconnect and approve email sending.');
    } else if (gmailStatus === 'oauth_error') {
      toast.error('Google OAuth was not completed. Please try connecting Google Workspace again.');
    } else if (gmailStatus === 'invalid_state') {
      toast.error('Google OAuth session expired. Start the connection again from Settings.');
    } else if (gmailStatus === 'callback_error') {
      toast.error('Unable to complete Google Workspace connection. Check OAuth settings and try again.');
    }
  }, [searchParams]);

  return null;
}
