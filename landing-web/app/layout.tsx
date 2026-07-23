import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.morefit.com.br'),
  title: {
    default: 'MoreFit — Saúde inteligente. Sua jornada começa aqui.',
    template: '%s — MoreFit',
  },
  description:
    'Peso, nutrição, exercícios e bem-estar em um só lugar — com IA que entende sua rotina. Baixe o MoreFit e transforme seu dia a dia.',
  applicationName: 'MoreFit',
  keywords: ['saúde', 'nutrição', 'peso', 'jejum intermitente', 'exercícios', 'IA', 'MoreFit', 'fitness Brasil'],
  authors: [{ name: 'MoreFit' }],
  creator: 'MoreFit',
  publisher: 'MoreFit',
  formatDetection: { email: false, telephone: false, address: false },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.morefit.com.br',
    siteName: 'MoreFit',
    title: 'MoreFit — Saúde inteligente',
    description: 'Peso, nutrição, exercícios e bem-estar em um só lugar — com IA.',
    images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'MoreFit' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoreFit — Saúde inteligente',
    description: 'Peso, nutrição, exercícios e bem-estar com IA.',
    images: ['/og-cover.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://www.morefit.com.br' },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <Header />
        <main>{children}</main>
        <Footer />
        <JsonLd />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-surface/80 backdrop-blur">
      <div className="container-mf flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand">
            <span className="text-brand-fg text-sm">✦</span>
          </span>
          MoreFit
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/#features" className="hover:text-brand-dark">Recursos</Link>
          <Link href="/#planos" className="hover:text-brand-dark">Planos</Link>
          <Link href="/blog" className="hover:text-brand-dark">Blog</Link>
          <Link href="/#faq" className="hover:text-brand-dark">FAQ</Link>
        </nav>
        <Link href="/#download" className="btn-primary text-sm py-2 px-4">
          Baixar app
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/5 bg-surface-soft">
      <div className="container-mf py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand">
              <span className="text-brand-fg text-sm">✦</span>
            </span>
            MoreFit
          </div>
          <p className="mt-3 text-sm text-ink-muted max-w-xs">
            Saúde inteligente para quem quer resultados reais, sem complicação.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-3">Produto</h4>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/#features">Recursos</Link></li>
            <li><Link href="/#planos">Planos</Link></li>
            <li><Link href="/blog">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-3">Empresa</h4>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/sobre">Sobre</Link></li>
            <li><Link href="/contato">Contato</Link></li>
            <li><Link href="/carreiras">Carreiras</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-3">Legal</h4>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/privacidade">Privacidade (LGPD)</Link></li>
            <li><Link href="/termos">Termos de uso</Link></li>
            <li><Link href="/cookies">Cookies</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/5">
        <div className="container-mf py-6 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} MoreFit — CNPJ XX.XXX.XXX/0001-XX • Feito com 💚 no Brasil
        </div>
      </div>
    </footer>
  );
}

function JsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MoreFit',
    url: 'https://www.morefit.com.br',
    logo: 'https://www.morefit.com.br/logo.png',
    sameAs: [
      'https://instagram.com/morefit',
      'https://twitter.com/morefit',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contato@morefit.com.br',
      contactType: 'customer support',
      areaServed: 'BR',
      availableLanguage: ['Portuguese'],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
