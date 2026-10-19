import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TenderWatch | Procurement Change Tracking';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          padding: '40px',
        }}
      >
        <div
          style={{
            fontSize: '64px',
            fontWeight: 'bold',
            letterSpacing: '-2px',
            marginBottom: '16px',
            background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          TenderWatch
        </div>
        <div
          style={{
            fontSize: '28px',
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Procurement Change Tracking & Snapshot Monitoring
        </div>
        <div
          style={{
            marginTop: '40px',
            padding: '10px 24px',
            background: '#18181b',
            borderRadius: '9999px',
            border: '1px solid #27272a',
            fontSize: '20px',
            color: '#38bdf8',
          }}
        >
          v1.0 Live Utility
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
