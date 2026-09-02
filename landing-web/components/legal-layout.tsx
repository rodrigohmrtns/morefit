import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <section className="py-16">
      <div className="container-mf max-w-3xl">
        <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">
          Documento legal
        </span>
        <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Última atualização:{' '}
          <time dateTime={updated}>
            {new Date(updated).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </time>
        </p>
        <article className="mt-10 prose prose-slate max-w-none prose-headings:font-bold prose-a:text-brand-dark prose-a:font-semibold prose-h2:mt-10 prose-h2:mb-3 prose-h3:mt-6">
          {children}
        </article>
        <div className="mt-16 rounded-2xl bg-brand-tint p-6 border border-brand-dark/10">
          <p className="text-sm text-brand-dark">
            <strong>Dúvidas?</strong> Fale com nosso Encarregado de Proteção de Dados (DPO) em{' '}
            <a href="mailto:dpo@morefit.com.br" className="underline">dpo@morefit.com.br</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

export function legalMetadata(title: string, description: string, slug: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `https://www.morefit.com.br/${slug}` },
    openGraph: { title, description, type: 'article' },
  };
}
