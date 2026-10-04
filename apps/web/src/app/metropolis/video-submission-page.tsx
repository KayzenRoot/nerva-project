import Link from 'next/link';
import { NervaBrand, NervaSymbol } from '../nerva-brand.tsx';

type VideoKind = 'technical-demo' | 'pitch-video';

const copy: Record<VideoKind, { readonly title: string; readonly summary: string }> = {
  'technical-demo': {
    title: 'NERVA Technical Demo — Video in production',
    summary:
      'Technical walkthrough will demonstrate Risk Dashboard, Policy Builder, Guided Demo, permission boundaries and Flight Recorder.',
  },
  'pitch-video': {
    title: 'NERVA Pitch Video — Video in production',
    summary:
      "Pitch video will introduce the problem, NERVA's safety-first approach, market opportunity and roadmap.",
  },
};

const flow = ['MARKET CONTEXT', 'RISK EVIDENCE', 'POLICY', 'SIMULATION', 'FLIGHT RECORDER'];

export function VideoSubmissionPage({ kind }: { readonly kind: VideoKind }) {
  const page = copy[kind];
  return (
    <main className="marketing-shell video-placeholder" lang="en">
      <header className="marketing-topbar">
        <Link className="brand" href="/?lang=en" aria-label="NERVA home">
          <NervaBrand />
        </Link>
        <span className="environment environment-demo">TESTNET_DEMO</span>
      </header>

      <section className="placeholder-hero" aria-labelledby="video-title">
        <div className="placeholder-copy">
          <p className="eyebrow">METROPOLIS · VIDEO SUBMISSION</p>
          <span className="placeholder-status-tag">Temporary submission placeholder</span>
          <h1 id="video-title">{page.title}</h1>
          <p className="placeholder-summary">{page.summary}</p>

          <section className="video-production-notice" aria-label="Video production status">
            <span className="production-indicator" aria-hidden="true" />
            <div>
              <strong>Video in production</strong>
              <p>
                The official video is currently being produced and will replace this temporary page
                before final submission.
              </p>
            </div>
          </section>

          <div className="placeholder-safety" aria-label="Execution safety boundaries">
            <span>MAINNET EFFECT = HARD_BLOCKED</span>
            <span>LIVE PERPL WRITES = BLOCKED</span>
          </div>

          <div className="placeholder-actions">
            <Link className="button button-primary" href="/demo?lang=en">
              Open NERVA Live Demo <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" href="/dashboard?lang=en">
              Explore the risk dashboard
            </Link>
          </div>
        </div>

        <aside className="placeholder-visual" aria-label="NERVA decision evidence flow">
          <div className="placeholder-visual-head">
            <NervaSymbol />
            <div>
              <span>DECISION SYSTEM</span>
              <strong>Observable by design</strong>
            </div>
            <span className="visual-pulse" aria-hidden="true" />
          </div>
          <ol className="placeholder-flow">
            {flow.map((step, index) => (
              <li key={step}>
                <span className="placeholder-flow-index">0{index + 1}</span>
                <span>{step}</span>
                {index < flow.length - 1 ? <span className="placeholder-flow-line" /> : null}
              </li>
            ))}
          </ol>
          <p className="placeholder-visual-note">
            Static product overview · no video file is embedded
          </p>
        </aside>
      </section>

      <footer className="placeholder-footer">
        <span>NERVA · Safety-first market observation</span>
        <span>TESTNET_DEMO · No financial effect</span>
      </footer>
    </main>
  );
}
