import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Youmi Box - Digital Collectibles',
  description: 'Discover and collect unique digital items on BSC blockchain.',
  other: {
    'og:title': 'Youmi Box - Digital Collectibles',
    'og:description': 'Discover and collect unique digital items on BSC blockchain.',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
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
