import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllSlugs, getPostBySlug } from '@/lib/posts';

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://www.morefit.com.br/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) return notFound();

  return (
    <article className="py-16">
      <div className="container-mf max-w-3xl">
        <Link href="/blog" className="text-sm text-ink-muted hover:text-brand-dark">
          ← Todos os artigos
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </time>
          <span>•</span>
          <span>{post.readingTime}</span>
          <span>•</span>
          <span>por {post.author}</span>
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">{post.title}</h1>
        <p className="mt-4 text-xl text-ink-soft">{post.description}</p>
        <div className="mt-10 prose prose-slate max-w-none prose-headings:font-bold prose-a:text-brand-dark prose-a:font-semibold">
          <MDXRemote source={post.content} />
        </div>
        <div className="mt-16 border-t border-ink/10 pt-8">
          <div className="rounded-3xl bg-brand-tint p-6">
            <h3 className="text-xl font-bold text-brand-dark">Comece agora com o MoreFit</h3>
            <p className="mt-2 text-brand-dark/80">Baixe grátis e coloque em prática o que aprendeu.</p>
            <Link href="/#download" className="btn-primary mt-4 inline-flex">Baixar app</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
