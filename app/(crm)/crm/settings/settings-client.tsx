'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function GmailStatusToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('gmail') === 'connected') {
      toast.success('Gmail connected successfully!');
    }
  }, [searchParams]);

  return null;
}
