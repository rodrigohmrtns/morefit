import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';

export const metadata: Metadata = {
  title: {
    default: 'Portal Profissional — MoreFit',
    template: '%s — MoreFit Pro',
  },
  description: 'Painel profissional MoreFit — acompanhe pacientes, gere relatórios e insights.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
