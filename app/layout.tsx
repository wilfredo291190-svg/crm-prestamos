import React from 'react';
import './globals.css';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

export const metadata = {
  title: "Presta'o - CRM de Préstamos",
  description: 'Sistema de gestión de para micro préstamos personales',
  verification: {
    google: 'VGCvnxWNhrZuqkzmtywxIM0uI1KxVbSqB-Yvg7swx4U',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={montserrat.variable}>
      <head>
        <meta name="google-site-verification" content="VGCvnxWNhrZuqkzmtywxIM0uI1KxVbSqB-Yvg7swx4U" />
      </head>
      <body className={`${montserrat.className} bg-gray-950 text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
