import Link from 'next/link';
import Image from 'next/image';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Portal navbar */}
      <header className="bg-white border-b border-[#DDE3EF]" style={{ boxShadow: '0 1px 2px rgba(10,22,40,0.04)' }}>
        <div className="max-w-[1000px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-[7px] overflow-hidden bg-[#0F1E35] shrink-0">
              <Image
                src="/elite-funding-logo.png"
                alt="Elite Funding Solutions"
                width={28}
                height={28}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[13px] text-[#0A1628] leading-tight">Elite Funding Solutions</span>
            </div>
            <span className="text-[12px] ml-1 font-medium" style={{ color: '#8C9BB5' }}>Client Portal</span>
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium transition-colors"
            style={{ color: '#5A6A85' }}
          >
            Sign Out
          </Link>
        </div>
      </header>
      <main className="max-w-[1000px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
