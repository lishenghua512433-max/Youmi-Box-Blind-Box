import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YouMiBox - BSC NFT Blind Box',
  description: 'Unbox treasures, high-tier collectibles auto-recycled for steady gains, invite friends to earn commissions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
