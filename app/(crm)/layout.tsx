import { CrmSidebar } from '@/components/crm/sidebar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Elite CRM Nexus | Elite Funding Solutions',
  description: 'Elite Funding Solutions CRM for pipeline, underwriting, documents, offers, renewals, and earnings.',
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-shell-bg flex h-screen flex-col overflow-hidden">
      <CrmSidebar />
      <main className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
