import React from 'react';

export const metadata = {
  title: 'CRM Préstamos',
  description: 'Sistema de gestión de préstamos personales',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-900 text-white">
        {children}
      </body>
    </html>
  );
}
