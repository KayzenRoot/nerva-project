import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { resolveLocale, messages } from './i18n.ts';
import './styles.css';
import './m05.css';

async function getRequestLocale() {
  const requestHeaders = await headers();
  return resolveLocale(requestHeaders.get('x-nerva-locale') ?? undefined);
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = messages[await getRequestLocale()];
  return { title: copy.documentTitle, description: copy.documentDescription };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
