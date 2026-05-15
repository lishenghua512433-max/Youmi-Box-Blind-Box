import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Youmi Box Blind Box - BSC NFT Blind Box',
  description: 'Youmi Box Blind Box, get rare collections easily, gain stable profits & earn commission by inviting friends',
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
