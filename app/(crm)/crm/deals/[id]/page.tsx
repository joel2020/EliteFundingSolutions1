import { CrmDealDetailExperience } from '@/components/crm/crm-platform';

export default function DealDetailPage({ params }: { params: { id: string } }) {
  return <CrmDealDetailExperience dealId={params.id} />;
}
