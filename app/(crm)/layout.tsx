import { CrmSidebar } from '@/components/crm/sidebar';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] pt-14">
      <CrmSidebar />
      <main className="flex h-full min-w-0 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
