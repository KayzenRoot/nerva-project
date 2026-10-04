import type { Metadata } from 'next';
import { VideoSubmissionPage } from '../video-submission-page.tsx';

const title = 'NERVA Technical Demo — Video in production';
const description =
  'Technical walkthrough will demonstrate Risk Dashboard, Policy Builder, Guided Demo, permission boundaries and Flight Recorder.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: 'NERVA', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function TechnicalDemoPlaceholderPage() {
  return <VideoSubmissionPage kind="technical-demo" />;
}
