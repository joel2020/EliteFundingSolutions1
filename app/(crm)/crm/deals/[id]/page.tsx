import { CrmDealDetailExperience } from '@/components/crm/crm-platform';

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmDealDetailExperience dealId={id} />;
}
