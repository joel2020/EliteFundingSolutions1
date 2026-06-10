'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function GmailStatusToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const gmailStatus = searchParams?.get('gmail');
    const gmailError = searchParams?.get('gmail_error');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected successfully!');
    } else if (gmailError === 'missing_gmail_send_scope') {
      toast.error('Google did not grant Gmail send permission. Reconnect and approve email sending.');
    } else if (gmailError === 'access_denied' || gmailError === 'no_code') {
      toast.error('Google OAuth was not completed. Please try connecting Google Workspace again.');
    } else if (gmailError === 'invalid_oauth_state' || gmailError === 'state_user_mismatch') {
      toast.error('Google OAuth session expired. Start the connection again from Settings.');
    } else if (gmailError === 'missing_access_token' || gmailError === 'missing_google_email' || gmailError === 'storage_failed' || gmailError === 'auth_failed') {
      toast.error('Unable to complete Google Workspace connection. Check OAuth settings and try again.');
    } else if (gmailError) {
      toast.error('Google OAuth was not completed. Please try connecting Google Workspace again.');
    }
  }, [searchParams]);

  return null;
}
