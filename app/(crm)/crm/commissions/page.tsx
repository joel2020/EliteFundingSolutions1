'use client';
import { CrmTopbar } from '@/components/crm/topbar';
export default function CommissionsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar title="Commissions" subtitle="Track and manage commission payments" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-[#A1A1AA]">Content coming soon.</p>
        </div>
      </div>
    </div>
  );
}
