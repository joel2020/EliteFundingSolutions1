import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Elite Funding Solutions — Fast, Flexible Capital for Ambitious Businesses',
  description:
    'Elite Funding Solutions provides fast, flexible business capital up to $5M. Funding decisions in as little as 4 hours. No collateral required.',
  keywords: ['merchant cash advance', 'business funding', 'working capital', 'MCA', 'elite funding', 'business capital'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-[#F8F9FB] text-[#0A1628]`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
