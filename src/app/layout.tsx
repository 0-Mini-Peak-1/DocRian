import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocRian | Durian Disease Detector',
  description: 'AI-powered durian disease detection from leaf images. Upload photos to diagnose your durian trees instantly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
