import './globals.css';

export const metadata = {
  metadataBase: new URL('https://tenderwatch-eta.vercel.app'),
  title: 'TenderWatch | Tender Change Tracking',
  description: 'Spot changes on a tender page instantly.',
  openGraph: {
    title: 'TenderWatch | Tender Change Tracking',
    description: 'Spot changes on a tender page instantly.',
    url: 'https://tenderwatch-eta.vercel.app',
    siteName: 'TenderWatch',
    images: [
      {
        url: 'https://tenderwatch-eta.vercel.app/opengraph-image',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'TenderWatch Preview',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenderWatch | Tender Change Tracking',
    description: 'Spot changes on a tender page instantly.',
    images: ['https://tenderwatch-eta.vercel.app/opengraph-image'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
