import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HoloGen',
  description: 'Transform any image into an interactive 3D holographic particle cloud',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-900 text-white antialiased">{children}</body>
    </html>
  );
}
