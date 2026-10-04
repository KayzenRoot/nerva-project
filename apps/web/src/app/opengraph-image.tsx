import { ImageResponse } from 'next/og';

export const alt = 'NERVA — Risk intelligence with verifiable accountability';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: 'radial-gradient(ellipse at 74% 30%, #392875 0%, #151020 42%, #07070A 78%)',
        color: '#F7F7FB',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: '64px 72px',
        width: '100%',
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
        <div
          style={{
            alignItems: 'center',
            background: '#14111E',
            border: '1px solid #7C5CFF',
            borderRadius: 18,
            color: '#C5B7FF',
            display: 'flex',
            fontSize: 34,
            fontWeight: 700,
            height: 64,
            justifyContent: 'center',
            width: 64,
          }}
        >
          N
        </div>
        <div style={{ color: '#F7F7FB', fontSize: 32, fontWeight: 700, letterSpacing: 8 }}>
          NERVA
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
        <div style={{ color: '#BBA9FF', fontSize: 19, fontWeight: 700, letterSpacing: 4 }}>
          RISK INTELLIGENCE · MONAD
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -3, lineHeight: 1.04 }}>
          Deterministic risk. Verifiable accountability.
        </div>
        <div style={{ color: '#B3B0C1', fontSize: 23, lineHeight: 1.4 }}>
          Read-only market observations and policy simulation for perpetual markets.
        </div>
      </div>
      <div style={{ color: '#C5B7FF', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
        MAINNET EFFECT = HARD_BLOCKED · LIVE PERPL WRITES = BLOCKED
      </div>
    </div>,
    { ...size },
  );
}
