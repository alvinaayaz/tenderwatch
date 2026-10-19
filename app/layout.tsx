import './globals.css';

export const metadata = {
  title: 'TenderWatch | Tender Change Tracking',
  description: 'Spot changes on a tender page instantly.',
  openGraph: {
    title: 'TenderWatch',
    description: 'Spot changes on a tender page.',
    images: ['/og-image.png'],
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
