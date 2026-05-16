import { PublicNavbar } from '@/components/public/navbar';
import { PublicFooter } from '@/components/public/footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#05101d]">
      <PublicNavbar />
      <main className="flex-1 pt-20 md:pt-24">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
