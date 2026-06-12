import { CrmDealDetailExperience } from '@/components/crm/crm-platform';

export default function DealDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CrmDealDetailExperience dealId={params.id} />
      </div>
    </div>
  );
}
