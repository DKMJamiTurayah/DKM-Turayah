import './globals.css';

const NAMA = process.env.NEXT_PUBLIC_NAMA_DKM || 'DKM Masjid Jami Turayah';

export const metadata = {
  title: NAMA,
  description: 'Sistem keuangan & pengajuan anggaran ' + NAMA,
    icons: { icon: [{ url: '/favicon.ico' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  manifest: '/manifest.json'
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f5e47' };

export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
