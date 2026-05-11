import { CrmSidebar } from '@/components/crm/sidebar';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
      <CrmSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[260px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
