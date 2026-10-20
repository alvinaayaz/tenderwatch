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
<<<<<<< HEAD
        url: 'https://tenderwatch-eta.vercel.app/opengraph-image.png',
=======
        url: 'https://tenderwatch-eta.vercel.app/opengraph-image',
>>>>>>> a6d399795cb77de614cc9fdb308ef0bae6b6fc42
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
<<<<<<< HEAD
    description: description,
    images: ['https://tenderwatch-eta.vercel.app/opengraph-image.png'],
=======
    description: 'Spot changes on a tender page instantly.',
    images: ['https://tenderwatch-eta.vercel.app/opengraph-image'],
>>>>>>> a6d399795cb77de614cc9fdb308ef0bae6b6fc42
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
