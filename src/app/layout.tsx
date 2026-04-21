import type { Metadata } from 'next';
import './globals.css';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'DocRian | Durian Disease Detector',
  description: 'AI-powered durian disease detection from leaf images. Upload photos to diagnose your durian trees instantly.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value || 'light';

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={theme === 'dark' ? 'dark' : ''}>{children}</body>
    </html>
  );
}
