import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Login | Elite Funding Solutions',
  description: 'Secure CRM and client portal access for authorized Elite Funding Solutions users.',
  alternates: { canonical: '/login' },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
