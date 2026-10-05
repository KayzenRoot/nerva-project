import { notFound } from 'next/navigation';
import { resolveLocale } from '../../../i18n.ts';
import { RecordingDemoView } from '../recording-view.tsx';
import type { RecordingSurface } from '../recording-model.ts';

const allowedSurfaces = new Set<RecordingSurface>(['risk', 'policy', 'flight-recorder']);

export default async function RecordingSurfacePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly surface: string }>;
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const [{ surface }, query] = await Promise.all([params, searchParams]);
  if (!allowedSurfaces.has(surface as RecordingSurface)) notFound();
  return (
    <RecordingDemoView surface={surface as RecordingSurface} locale={resolveLocale(query.lang)} />
  );
}
