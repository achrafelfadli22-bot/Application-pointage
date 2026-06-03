import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pointage360',
  description: 'SaaS RH multi-tenant pour pointage, timesheets, conges et chantiers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
