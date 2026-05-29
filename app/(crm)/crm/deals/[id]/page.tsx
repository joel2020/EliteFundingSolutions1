import { DealAiAnalysisPlaceholder } from '@/components/crm/deal-ai-analysis-placeholder';
import { CrmDealDetailExperience } from '@/components/crm/crm-platform';

export default function DealDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DealAiAnalysisPlaceholder dealId={params.id} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <CrmDealDetailExperience dealId={params.id} />
      </div>
    </div>
  );
}
