import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Care Setu — Doctor',
  description: 'Your patients. Your day. In your pocket.',
  manifest: '/doctor/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Care Setu',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4338ca',
};

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      {children}
    </div>
  );
}
