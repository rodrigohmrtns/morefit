import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/posts';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Artigos sobre nutrição, treino, sono e bem-estar. Ciência aplicada ao seu dia a dia.',
  alternates: { canonical: 'https://www.morefit.com.br/blog' },
};

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <section className="py-16">
      <div className="container-mf max-w-4xl">
        <span className="rounded-pill bg-brand-tint px-4 py-1 text-xs font-bold text-brand-dark">Blog</span>
        <h1 className="mt-4 text-5xl font-bold tracking-tight">Ciência que cabe no seu dia.</h1>
        <p className="mt-3 text-lg text-ink-soft max-w-2xl">
          Artigos revisados por nutricionistas e treinadores da nossa comunidade.
        </p>

        <div className="mt-12 space-y-6">
          {posts.length === 0 && (
            <p className="text-ink-muted">Em breve, novos artigos.</p>
          )}
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block card hover:scale-[1.005] transition"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <time dateTime={p.date}>
                  {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </time>
                <span>•</span>
                <span>{p.readingTime}</span>
                {p.tags?.slice(0, 2).map((t) => (
                  <span key={t} className="rounded-pill bg-brand-tint px-2 py-0.5 text-brand-dark font-semibold">
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 text-2xl font-bold group-hover:text-brand-dark">{p.title}</h2>
              <p className="mt-2 text-ink-soft">{p.description}</p>
              <div className="mt-4 text-sm font-semibold text-brand-dark">Ler artigo →</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
