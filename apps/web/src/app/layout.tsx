import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { resolveLocale, messages } from './i18n.ts';
import './styles.css';
import './m05.css';
import './visual-polish.css';

async function getRequestLocale() {
  const requestHeaders = await headers();
  return resolveLocale(requestHeaders.get('x-nerva-locale') ?? undefined);
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await getRequestLocale()];
  const deploymentHost = process.env.VERCEL_URL;
  return {
    metadataBase: new URL(deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000'),
    title: copy.documentTitle,
    description: copy.documentDescription,
    applicationName: 'NERVA',
    icons: {
      icon: '/icon.png',
      shortcut: '/icon.png',
      apple: '/icon.png',
    },
    openGraph: {
      title: copy.documentTitle,
      description: copy.documentDescription,
      siteName: 'NERVA',
      type: 'website',
      images: [
        {
          url: '/branding/nerva-logo.png',
          width: 1254,
          height: 1254,
          alt: 'Official NERVA logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.documentTitle,
      description: copy.documentDescription,
      images: ['/branding/nerva-logo.png'],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
