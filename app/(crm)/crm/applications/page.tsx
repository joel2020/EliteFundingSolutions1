import { redirect } from 'next/navigation';

export default function RemovedSectionRedirect() {
  redirect('/crm/deals');
}
