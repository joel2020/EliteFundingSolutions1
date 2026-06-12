import { redirect } from 'next/navigation';

export default function OffersRedirect() {
  redirect('/crm/deals?stage=approved');
}
