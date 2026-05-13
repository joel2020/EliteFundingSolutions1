import { CrmSidebar } from '@/components/crm/sidebar';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F6F7FA] overflow-hidden">
      <CrmSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden transition-[padding] duration-200 md:pl-[var(--crm-sidebar-width,260px)]">
        {children}
      </main>
    </div>
  );
}
