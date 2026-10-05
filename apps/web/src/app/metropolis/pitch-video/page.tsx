import type { Metadata } from 'next';
import { VideoSubmissionPage } from '../video-submission-page.tsx';

const title = 'NERVA Pitch Video — Video in production';
const description =
  "Pitch video will introduce the problem, NERVA's safety-first approach, market opportunity and roadmap.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: 'NERVA', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function PitchVideoPlaceholderPage() {
  return <VideoSubmissionPage kind="pitch-video" />;
}
