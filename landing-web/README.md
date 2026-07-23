# MoreFit — Landing (morefit.com.br)

Site institucional Next.js 14 (App Router) para **www.morefit.com.br**.

## Stack
- Next.js 14 + React 18 + TypeScript
- Tailwind CSS
- MDX (blog posts em `content/posts/*.mdx`)
- lucide-react (ícones)
- SEO completo (metadata, sitemap, robots, Open Graph)

## Dev local
```bash
cd landing-web
yarn install
yarn dev            # http://localhost:3100
```

## Build de produção
```bash
yarn build
yarn start          # http://localhost:3100
```

## Deploy — Locaweb (VPS/Cloud Node.js)

### 1. Preparar o servidor (Ubuntu/Debian)
```bash
# SSH no VPS
sudo apt update && sudo apt install -y nodejs npm
sudo npm i -g pm2 yarn
```

### 2. Clone + build
```bash
git clone git@github.com:<seu-user>/<repo>.git /var/www/morefit-landing
cd /var/www/morefit-landing/landing-web
yarn install --frozen-lockfile
yarn build
```

### 3. Rodar com PM2 (auto-restart)
```bash
pm2 start "yarn start" --name morefit-landing
pm2 save && pm2 startup
```

### 4. Nginx (proxy reverso + SSL Let's Encrypt)
```nginx
server {
  server_name www.morefit.com.br morefit.com.br;
  location / {
    proxy_pass http://localhost:3100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
  }
}
```
```bash
sudo certbot --nginx -d www.morefit.com.br -d morefit.com.br
```

### 5. Deploy automatizado
Ver `.github/workflows/landing-deploy.yml` na raiz do repositório.

## Adicionar novo post
Crie arquivo em `content/posts/meu-slug.mdx`:
```mdx
---
title: Meu título
description: Descrição para SEO e social share
date: 2026-07-22
author: Seu Nome
tags: ['tag1', 'tag2']
---

Conteúdo em Markdown/MDX aqui.
```

## Estrutura
```
landing-web/
├── app/
│   ├── page.tsx              (Home — hero, features, planos, FAQ)
│   ├── layout.tsx            (header + footer globais + JSON-LD)
│   ├── globals.css           (Tailwind + tokens)
│   ├── sitemap.ts            (auto)
│   ├── robots.ts             (auto)
│   └── blog/
│       ├── page.tsx          (lista de posts)
│       └── [slug]/page.tsx   (post individual MDX)
├── content/posts/*.mdx       (artigos)
├── lib/posts.ts              (loader MDX + frontmatter)
└── public/                   (favicon, og-cover, imagens)
```
