import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Elite Funding Solutions — Institutional Business Funding & Private Credit Advisory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #030812 0%, #0A1730 55%, #101D2F 100%)',
          padding: '72px 80px',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 18,
              height: 56,
              borderRadius: 4,
              background: '#C9A45C',
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, color: '#E3C77A' }}>
            ELITE FUNDING SOLUTIONS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>
            Institutional Business Funding & Private Credit Advisory
          </div>
          <div style={{ fontSize: 30, color: '#B9C2D0', maxWidth: 940, lineHeight: 1.3 }}>
            Advisor-led working capital, lines of credit, equipment financing, SBA options, and revenue-based funding for U.S. operators.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 26, color: '#E3C77A', fontWeight: 600 }}>elitefundingsolution.com</div>
          <div style={{ fontSize: 24, color: '#8C9BB5' }}>Secure · Advisor-led · Nationwide</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
