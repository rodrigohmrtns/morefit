import type { MetadataRoute } from 'next';
import { getAllSlugs } from '@/lib/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.morefit.com.br';
  const now = new Date();
  const staticRoutes = ['', '/blog', '/sobre', '/contato', '/privacidade', '/termos', '/cookies'].map((r) => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: r === '' ? 1 : 0.7,
  }));
  const posts = getAllSlugs().map((slug) => ({
    url: `${base}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  return [...staticRoutes, ...posts];
}
