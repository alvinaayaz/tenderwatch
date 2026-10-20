import './globals.css';

const description = 'TenderWatch is a procurement monitoring utility designed to track public tender pages, take baseline snapshot comparisons, and highlight potential document edits instantly.';

export const metadata = {
  metadataBase: new URL('https://tenderwatch-eta.vercel.app'),
  title: 'TenderWatch | Tender Change Tracking',
  description: description,
  openGraph: {
    title: 'TenderWatch | Tender Change Tracking',
    description: description,
    url: 'https://tenderwatch-eta.vercel.app',
    siteName: 'TenderWatch',
    images: [
      {
        url: 'https://tenderwatch-eta.vercel.app/opengraph-image.png',
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
    description: description,
    images: ['https://tenderwatch-eta.vercel.app/opengraph-image.png'],
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
